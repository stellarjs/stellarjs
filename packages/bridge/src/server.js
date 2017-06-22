import Promise from 'bluebird';
import _ from 'lodash';
import stringify from 'safe-json-stringify';

import {
  stellarRequest as stellarRequestFactory,
  stellarSource,
  configureStellar } from '@stellarjs/core';
import redisTransportFactory from '@stellarjs/transport-redis';
import { WebsocketTransport } from '@stellarjs/transport-socket';

let stellarRequest;
function connectToMicroservices(log, middlewares) {
  return configureStellar({ log, transportFactory: redisTransportFactory })
    .then(() => {
      stellarRequest = stellarRequestFactory();

      _.forEach(middlewares, ({ match, mw }) => stellarRequest.use(match, mw));
      // TODO customize
      // stellarRequest.use('^((?!iam:entityOnline).)*$', (req, next, options) => {
      //   _.assign(req.headers, options.session.headers);
      //   return next();
      // });
    });
}

const sessions = {};
function startSession(log, socket) {
  sessions[socket.id] = {
    sessionId: socket.id,
    ip: _.get(socket, 'request.connection.remoteAddress'),
    reactiveStoppers: {},
    registerStopper(channel, stopper) {
      _.assign(this.reactiveStoppers,
        {
          [channel]() {
            log.info(`@StellarBridge: Session ${this.sessionId}: stopped subscription ${channel}`);
            stopper();
            delete this.reactiveStoppers[channel];
          },
        }
      );
    },
    offlineFns: [() => {
      log.info(`@StellarBridge: Session ${this.sessionId} ended session`);
      delete this[socket.id];
    }],
  };

  return sessions[socket.id];
}

function assignClientToSession({ log, socket, session }) {
  return _.assign(session, { client: new WebsocketTransport(socket, log, true) });
}

// TODO customize
// function startSession({operation, user}, socket) {
//   return EntityOnline.online(operation._id, user._id, 'user')
//     .then((notifyOffline) => {
//       const onlineData = {
//         authenticatedUserId: user._id,
//         requestUserId: user._id,
//         sessionId: socket.id,
//         operationId: operation._id,
//         domain: operation.domain,
//         ip: socket.request.connection.remoteAddress,
//         reactiveStoppers: {},
//         client: new WebsocketTransport(socket, log, true),
//         registerStopper: (channel, stopper) => _.assign(onlineData.reactiveStoppers, { [channel]: () => {
//           log.info(`@StellarBridge: Session ${onlineData.sessionId}: stopped subscription ${channel}`);
//           stopper();
//           delete onlineData.reactiveStoppers[channel];
//         } }),
//         impersonateUserId: requestUserId => _.assign(onlineData, { requestUserId }),
//         headers: { userId: user._id, operationId: operation.id }),
//         offlineFn: () => {
//           log.info(`@StellarBridge: Session ${onlineData.sessionId} ended session`);
//           delete sessions[user._id];
//           this.notifyOffline();
//         },
//         notifyOffline,
//       };
//
//       sessions[user._id] = onlineData;
//
//       return onlineData;
//     });
// }

function sendResponse(log, client, command, jobDataResp) {
  if (_.isUndefined(client)) {
    log.info('Socket was closed before response was sent.');
    return Promise.reject(new Error('Socket was closed'));
  }

  log.info(`@StellarBridge: bridging response: ${JSON.stringify(jobDataResp.headers)}`);

  const requestId = command.data.headers.id;
  const queueName = command.data.headers.respondTo;

  const headers = _.defaults({ requestId, queueName, source: stellarSource() }, jobDataResp.headers);
  const obj = { headers, body: jobDataResp.body };
  log.info(`@StellarBridge.enqueue ${queueName}: ${stringify(obj)}`);
  return client.enqueue(queueName, obj);
}

function bridgeReactive(log, client, requestHeaders) {
  return (subscriptionData, channel) => {
    log.info(`@StellarBridge: bridging subscription: ${JSON.stringify(subscriptionData)}`);

    const queueName = `stlr:n:${requestHeaders.source}:subscriptionInbox`; // queueName hard coded from StellarPubSub pattern
    const headers = _.defaults({ channel, queueName, source: stellarSource() }, subscriptionData.headers);
    const obj = { headers, body: subscriptionData.body };

    log.info(`@StellarBridge.enqueue ${queueName}: ${stringify(obj)}`);
    return client.enqueue(queueName, obj);
  };
}

function handleMessage(log, session, command) {
  const requestHeaders = command.data.headers;

  switch (requestHeaders.type) {
    case 'request': {
      return stellarRequest
        ._doQueueRequest(requestHeaders.queueName,
                         command.data.body,
                         _.defaults({ source: stellarSource() }, requestHeaders),
                         { session, responseType: 'jobData' })
        .then(response => sendResponse(log, session.client, command, response));
    }
    case 'stopReactive': {
      const stopper = session.reactiveStoppers[requestHeaders.channel];
      if (stopper) {
        return stopper();
      }

      return Promise.resolve(false);
    }
    case 'reactive': {
      const options = { session, responseType: 'jobData' };
      const reactiveRequest = {
        results: stellarRequest._doQueueRequest(requestHeaders.queueName,
                                                 command.data.body,
                                                 _.defaults({ source: stellarSource() }, requestHeaders),
                                                 options),
        onStop: stellarRequest.pubsub.subscribe(requestHeaders.channel,
                                                 bridgeReactive(log, session.client, requestHeaders),
                                                 options),
      };


      reactiveRequest.onStop.then(stopper => session.registerStopper(requestHeaders.channel, stopper));

      return reactiveRequest.results.then(response => sendResponse(log, session.client, command, response));
    }
    // TODO customize
    // case 'impersonate': {
    //   log.info(`@StellarBridge.impersonateUser(${command.data.body.targetUserId})`);
    //   // TODO convert to middleware stellarRequest.use('accounts:impersonate', () =>
    //   return isUserPermitted(session.operation._id, session.user, PERMISSIONS.IMPERSONATE)
    //     .then((isPermitted) => {
    //       log.info(isPermitted);
    //       if (!isPermitted) {
    //         // TODO throw new Error(`Invalid impersonation request`);
    //         log.error(
    //           `@StellarBridge.impersonateUser(${command.data.body.targetUserId}) Invalid impersonation request`);
    //         return session;
    //       }
    //
    //       return session.impersonateUserId(command.data.body.targetUserId);
    //     });
    // }
    default: {
      throw new Error(`Invalid stellar bridge message: ${JSON.stringify(command)}`);
    }
  }
}

function initErrorHandlers(log, errorHandlers) {
  return function reportError(e, session, command) {
    log.error(e, 'Error Reported');

    const sessionVars = _.pick(
      session,
      ['authenticatedUserId', 'requestUserId', 'sessionId', 'operationId', 'domain', 'ip']
    );

    if (_.isObject(command)) {
      const bridgeRequestType = _(command).get('data.headers.type', 'noType');
      const queueName = _(command).get('data.headers.queueName');
      const channel = _(command).get('data.headers.channel');
      const path = `${bridgeRequestType}/${queueName || channel || ''}`;
      const method = queueName ? _.last(queueName.split(':')) : undefined;
      const dataHeaders = _.get(command, 'data.headers');

      _.forEach(errorHandlers, errorHandler => errorHandler({
        headers: _.assign({}, sessionVars, dataHeaders),
        method,
        route: { path },
        body: _.get(command, 'data.body', JSON.stringify(command)),
      }));
    } else {
      _.forEach(errorHandlers, errorHandler => errorHandler({ headers: sessionVars, body: command }));
    }
  };
}

function doCallHandlers(handlers, index, { log, session, socket }) {
  if (_.size(handlers) === index) {
    return session;
  }

  return Promise
    .try(() => handlers[index]({ log, session, socket }))
    .then(nextSession => doCallHandlers(handlers, index + 1, { log, session: nextSession, socket }))
    .catch((e) => {
      log.error(e, 'error calling handlers');
      throw e;
    });
}

function callHandlersSerially(handlers, context) {
  return doCallHandlers(handlers, 0, context);
}

function getTxName(requestHeaders) {
  if (requestHeaders.queueName) {
    return `${requestHeaders.queueName}`;
  }

  return requestHeaders.type;
}

function init({
                server,
                log = console,
                errorHandlers = [],
                newSessionHandlers = [],
                instrumentation = {
                  startTransaction(txName, session, cb) { // eslint-disable-line no-unused-vars
                    cb();
                  },
                  done(e) {}, // eslint-disable-line no-unused-vars
                  sessionStarted(elapsed, session) { // eslint-disable-line no-unused-vars
                    // newrelic.recordMetric('Custom/Bridge/appConnection', );
                    log.info(`@StellarBridge Conneciton init in ${elapsed}ms`);
                  },
                  sessionFailed(elapsed, session) {}, // eslint-disable-line no-unused-vars
                },
                middlewares = [] }) {
  connectToMicroservices(log, middlewares);

  const reportError = initErrorHandlers(log, errorHandlers);
  const _newSessionHandlers = [assignClientToSession].concat(newSessionHandlers);
  server.on('connection', (socket) => {
    log.info(`@StellarBridge(${stellarSource()}): New Connection`);
    const startTime = Date.now();

    const initialSession = startSession(log, socket);
    callHandlersSerially(_newSessionHandlers, { log, socket, session: initialSession })
      .then((session) => {
        log.info(`@StellarBridge Connected: ${stringify(session)}`);

        socket.on('close', () => {
          _.forEach(session.reactiveStoppers, (stopper, channel) => {
            if (stopper) {
              stopper();
            } else {
              log.warn(
                `@StellarBridge.onclose: Session ${session.sessionId}: Unable to find stopper for ${channel}`);
            }
          });

          _.forEach(_.get(sessions, `${session.sessionId}.offlineFns`), _.invoke);

          log.info(`@StellarBridge.onclose: Deleting stellar websocket client for session ${session.sessionId}`);
          delete session.client; // eslint-disable-line no-param-reassign
        });

        socket.on('message', (str) => {
          log.info(`@StellarBridge bridging request: ${str}`);

          let command = null;
          try {
            command = JSON.parse(str);
          } catch (e) {
            reportError(e, session, str);
            return;
          }

          instrumentation.startTransaction(getTxName(command.data.headers), session, () => {
            Promise
              .try(() => handleMessage(log, session, command))
              .then(() => instrumentation.done())
              .catch((e) => {
                instrumentation.done(e);
                reportError(e, session, command);
              });
          });
        });

        // TODO remove the hiMessage
        log.info('Connection started');
        instrumentation.sessionStarted(Date.now() - startTime);
        const hiMessage = {
          messageType: 'connected',
          message: 'connected to stellar bridge',
          userId: session.authenticatedUserId,
          sessionId: session.sessionId };
        socket.send(JSON.stringify(hiMessage));
      })
      .catch((e) => {
        reportError(e, initialSession);
        log.error(e, 'Connection error');
        instrumentation.sessionFailed(Date.now() - startTime);
        const errorMessage = { messageType: 'error', errorType: e.constructor.name, message: e.message, status: 401 };
        socket.send(JSON.stringify(errorMessage));
      });
  });
}

export default init;
