import Promise from 'bluebird';
import engine from 'engine.io';
import _ from 'lodash';
import stringify from 'safe-json-stringify';

import {
  StellarCore,
  stellarRequest as stellarRequestFactory,
  stellarSource } from '@stellarjs/core';
import { configureStellar } from '@stellarjs/transport-redis';
import { WebsocketTransport } from '@stellarjs/transport-socket';

const log = console;

const port = process.env.PORT || 8091;
log.info(`Start initializing server on port ${port}`);
const server = engine.listen(port, { transports: ['websocket', 'polling'] }, () => {
  log.info('@StellarBridge: Server is running');
});

const originalHandler = server.handleRequest.bind(server);
server.handleRequest = function handleRequest(req, res) {
  log.info(`handleRequest:${req.method}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  originalHandler(req, res);
};

let stellarRequest;
function connectToMicroservices() {
  return configureStellar({ log })
    .then(() => {
      const val = stellarRequestFactory();
      stellarRequest = val;
      stellarRequest.use('^((?!iam:entityOnline).)*$', (req, next, options) => {
        _.assign(req.headers, options.session.headers);
        return next();
      });
    });
}
connectToMicroservices();

const sessions = {};
function startSession(socket) {
  sessions[socket.id] = {
    sessionId: socket.id,
    ip: _.get(socket, 'request.connection.remoteAddress'),
    reactiveStoppers: {},
    registerStopper: (channel, stopper) => _.assign(this.reactiveStoppers, { [channel]: () => {
      log.info(`@StellarBridge: Session ${this.sessionId}: stopped subscription ${channel}`);
      stopper();
      delete this.reactiveStoppers[channel];
    } }),
    offlineFns: [() => {
      log.info(`@StellarBridge: Session ${this.sessionId} ended session`);
      delete this[socket.id];
    }],
  };

  return sessions[socket.id];
}

function assignClientToSession(socket, session) {
  const result = _.assign(session, { client: new WebsocketTransport(socket, log, true) });
  return Promise.resolve(result);
}

//
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

function sendResponse(client, command, jobDataResp) {
  if (_.isUndefined(client)) {
    log.info('Socket was closed before response was sent.');
    return Promise.reject(new Error('Socket was closed'));
  }

  log.info(`@StellarBridge: bridging response: ${JSON.stringify(jobDataResp.headers)}`);

  const inbox = StellarCore.getServiceInbox(command.data.headers.queueName);
  const headers = _.defaults(
    { requestId: `${inbox}:${command.jobId}`, source: stellarSource() },
    jobDataResp.headers
  );

  const queueName = StellarCore.getNodeInbox(command.data.headers.source);
  const obj = { headers, body: jobDataResp.body };
  log.info(`@StellarCore.enqueue ${queueName}: ${stringify(obj, log)}`);
  return client.enqueue(queueName, obj);
}

function bridgeReactive(client, requestHeaders) {
  return (subscriptionData, channel) => {
    const body = subscriptionData.body;
    log.info(`@StellarBridge: bridging subscription: ${JSON.stringify(subscriptionData)}`);
    const headers = _.defaults(
      { channel, source: stellarSource() },
      subscriptionData.headers
    );
    return client.enqueue(
      `stlr:n:${requestHeaders.source}:subscriptionInbox`, // hard coded from StellarPubSub pattern
      { headers, body }
    );
  };
}

// function getTxName(requestHeaders) {
//   if (requestHeaders.queueName) {
//     return `bridge:${requestHeaders.queueName}`;
//   }
//
//   return requestHeaders.type;
// }

function handleMessage(session, command) {
  const requestHeaders = command.data.headers;

  switch (requestHeaders.type) {
    case 'request': {
      return stellarRequest
        ._doQueueRequest(requestHeaders.queueName,
                         command.data.body,
                         _.defaults({ source: stellarSource() }, requestHeaders),
                         { session, responseType: 'jobData' })
        .then(response => sendResponse(session.client, command, response));
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
                                                 bridgeReactive(session.client, requestHeaders),
                                                 options),
      };


      reactiveRequest.onStop.then(stopper => session.registerStopper(requestHeaders.channel, stopper));

      return reactiveRequest.results.then(response => sendResponse(session.client, command, response));
    }
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

const errorHandlers = [];
function reportError(e, session, command) {
  log.error(e);

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
}

function doCallHandlers(handlers, index, socket, session) {
  if (_.size(handlers) === index) {
    return session;
  }

  return handlers[index](socket, session)
    .then(nextSession => doCallHandlers(handlers, index + 1, socket, nextSession));
}

function callHandlersSerially(handlers, socket, session) {
  return doCallHandlers(handlers, 0, socket, session);
}

const newSessionHandlers = [assignClientToSession];
server.on('connection', (socket) => {
  log.info(`@StellarBridge(${stellarSource()}): New Connection`);

  const initialSession = startSession(socket);
  callHandlersSerially(newSessionHandlers, socket, initialSession)
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

        Promise
          .try(() => {
            handleMessage(session, command);
          })
          .catch((e) => {
            reportError(e, session, command);
          });
      });

      // TODO remove the hiMessage
      const hiMessage = {
        messageType: 'connected',
        message: 'connected to stellar bridge',
        userId: session.authenticatedUserId,
        sessionId: session.sessionId };
      log.info(`@StellarBridge: sending ${JSON.stringify(hiMessage)}`);
      // newrelic.recordMetric('Custom/Bridge/appConnection', completedAppConnection - startAppConnection);
      socket.send(JSON.stringify(hiMessage));
    })
    .catch((e) => {
      log.error('Error authentication connection');
      reportError(e, initialSession);
      const errorMessage = { messageType: 'error', message: e.message };
      socket.send(JSON.stringify(errorMessage));
    });
});

// _.assign(newSessionHandlers, {
//   operation: loadOperation,
//   user: loadUser,
//   session: startSession
// });

export { errorHandlers, newSessionHandlers };
