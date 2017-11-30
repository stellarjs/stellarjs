import Promise from 'bluebird';
import assign from 'lodash/assign';
import defaults from 'lodash/defaults';
import isObject from 'lodash/isObject';
import isUndefined from 'lodash/isUndefined';
import forEach from 'lodash/forEach';
import get from 'lodash/get';
import head from 'lodash/head';
import invoke from 'lodash/invoke';
import last from 'lodash/last';
import pick from 'lodash/pick';
import size from 'lodash/size';
import split from 'lodash/split';

import { StellarError } from '@stellarjs/core';
import { WebsocketTransport } from '@stellarjs/transport-socket';

function createStellarRequest(stellarFactory, middlewares) {
  const sourceOverride = `bridge-${stellarFactory.source}`;
  const stellarRequest = stellarFactory.stellarRequest({ sourceOverride });
  forEach(middlewares, ({ match, mw }) => stellarRequest.use(match, mw));
  return stellarRequest;
  // TODO customize
  // stellarRequest.use('^((?!iam:entityOnline).)*$', (req, next, options) => {
  //   _.assign(req.headers, options.session.headers);
  //   return next();
  // });
}

const sessions = {};
function startSession(log, source, socket) {
  const session = {
    source,
    sessionId: socket.id,
    ip: get(socket, 'request.connection.remoteAddress'),
    reactiveStoppers: {},
    logPrefix: `${source} @StellarBridge(${socket.id})`,
    registerStopper(channel, stopperPromise, requestId) {
      assign(session.reactiveStoppers,
        {
          [channel]: [requestId, () => {
            log.info(`${session.logPrefix}: stopped subscription`, { sessionId: socket.id, channel });
            if (!session.reactiveStoppers[channel]) {
              throw new Error(`ReactiveStopper for channel=${channel} requestId=${requestId} not found`);
            }

            delete session.reactiveStoppers[channel];
            return stopperPromise.then(stopper => stopper());
          }],
        }
      );
    },
    offlineFns: [() => {
      log.info(`${session.logPrefix}: ended session`, { sessionId: socket.id });
      delete session[socket.id];
    }],
  };

  sessions[socket.id] = session;  // eslint-disable-line better-mutation/no-mutation
  return session;
}

function assignClientToSession({ log, socket, session }) {
  return assign(session, { client: new WebsocketTransport(socket, log, true) });
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

function sendResponse(log, session, command, jobDataResp) {
  if (isUndefined(session.client)) {
    log.warn(`${session.logPrefix}: Socket was closed before response was sent.`);
    return Promise.reject(new Error('Socket was closed'));
  }

  const requestId = command.data.headers.id;
  const queueName = command.data.headers.respondTo;

  const headers = defaults({ requestId, queueName, source: session.source }, jobDataResp.headers);
  const obj = { headers, body: jobDataResp.body };
  log.info(`${session.logPrefix}.clientEnqueue`, { queueName, obj });
  return session.client.enqueue(queueName, obj);
}

function bridgeReactive(log, session, requestHeaders) {
  return (subscriptionData, channel) => {
    const queueName = `stlr:n:${requestHeaders.source}:subscriptionInbox`; // queueName hard coded from StellarPubSub pattern
    const headers = defaults({ channel, queueName, source: session.source }, subscriptionData.headers);
    const obj = { headers, body: subscriptionData.body };

    log.info(`${session.logPrefix}.clientEnqueue`, { channel, queueName, obj });
    return session.client.enqueue(queueName, obj);
  };
}

function handleMessage(log, stellarRequest, session, command) {
  const requestHeaders = command.data.headers;

  switch (requestHeaders.type) {
    case 'request': {
      return stellarRequest
        ._doQueueRequest(requestHeaders.queueName,
                         command.data.body,
                         defaults({ source: session.source }, requestHeaders),
                         { session, responseType: 'raw' })
        .then(response => sendResponse(log, session, command, response));
    }
    case 'stopReactive': {
      const stopper = last(session.reactiveStoppers[requestHeaders.channel]);
      if (stopper) {
        return stopper();
      }

      return Promise.resolve(false);
    }
    case 'reactive': {
      if (session.reactiveStoppers[requestHeaders.channel]) {
        const message = `Multiple subscriptions to same channel (${
          requestHeaders.channel}) not supported. First subscription sent ${
          head(session.reactiveStoppers[requestHeaders.channel])}`;

        return stellarRequest
          ._prepareResponse(command.data, new StellarError(message))
          .then((errorResponse) => {
            log.warn(session.logPrefix, message);

            return sendResponse(
              log,
              session,
              command,
              errorResponse
            );
          });
      }

      const options = { session, responseType: 'raw' };
      const reactiveRequest = {
        results: stellarRequest._doQueueRequest(requestHeaders.queueName,
                                                 command.data.body,
                                                 defaults({ source: session.source }, requestHeaders),
                                                 options),
        onStop: stellarRequest.pubsub.subscribe(requestHeaders.channel,
                                                 bridgeReactive(log, session, requestHeaders),
                                                 options),
      };

      session.registerStopper(requestHeaders.channel, reactiveRequest.onStop, requestHeaders.id);

      return reactiveRequest.results.then(response => sendResponse(log, session, command, response));
    }
    default: {
      throw new Error(`Invalid stellar bridge message: ${JSON.stringify(command)}`);
    }
  }
}

function initErrorHandlers(log, errorHandlers) {
  return function reportError(e, session, command) {
    log.error(e, 'Error Reported');

    const sessionVars = pick(
      session,
      ['authenticatedUserId', 'requestUserId', 'sessionId', 'operationId', 'domain', 'ip']
    );

    if (isObject(command)) {
      const bridgeRequestType = get(command, 'data.headers.type', 'noType');
      const queueName = get(command, 'data.headers.queueName');
      const channel = get(command, 'data.headers.channel');
      const path = `${bridgeRequestType}/${queueName || channel || ''}`;
      const method = queueName ? last(split(queueName, ':')) : undefined;
      const dataHeaders = get(command, 'data.headers');

      forEach(errorHandlers, errorHandler => errorHandler({
        headers: assign({}, sessionVars, dataHeaders),
        method,
        route: { path },
        body: get(command, 'data.body', JSON.stringify(command)),
      }));
    } else {
      forEach(errorHandlers, errorHandler => errorHandler({ headers: sessionVars, body: command }));
    }
  };
}

function doCallHandlers(handlers, index, { log, session, socket }) {
  if (size(handlers) === index) {
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
                stellarFactory,
                errorHandlers = [],
                newSessionHandlers = [],
                instrumentation = {
                  startTransaction(txName, session, cb) {
                    cb();
                  },
                  done(e) {}, // eslint-disable-line no-unused-vars, lodash/prefer-noop
                  sessionStarted(elapsed, session) { // eslint-disable-line no-unused-vars
                    // newrelic.recordMetric('Custom/Bridge/appConnection', );
                    log.info(`${session.logPrefix} Connection init in ${elapsed}ms`);
                  },
                  sessionFailed(elapsed, session) {}, // eslint-disable-line no-unused-vars, lodash/prefer-noop
                  // will be called on close and open with the current engine io status
                  numOfConnectedClients(elapsed, count) {
                    log.info(`number of connected clients ${count}`);
                  },
                },
                middlewares = [] }) {
  const stellarRequest = createStellarRequest(stellarFactory, middlewares);
  const reportError = initErrorHandlers(log, errorHandlers);
  const _newSessionHandlers = [assignClientToSession].concat(newSessionHandlers);

  function onMessage(str, session) {
    let command = null;
    try {
      command = JSON.parse(str);
    } catch (e) {
      reportError(e, session, str);
      return;
    }

    instrumentation.startTransaction(getTxName(command.data.headers), session, () => {
      Promise
        .try(() => handleMessage(log, stellarRequest, session, command))
        .then(() => instrumentation.done())
        .catch((e) => {
          instrumentation.done(e);
          reportError(e, session, command);
        });
    });
  }

  function onClose(session) {
    instrumentation.numOfConnectedClients(Date.now(), size(server.clients));
    forEach(session.reactiveStoppers, (stopper, channel) => {
      if (last(stopper)) {
        last(stopper)();
      } else {
        log.error(`${session.logPrefix}: Unable to find stopper for ${channel}`,
                  { sessionId: session.sessionId, channel });
      }
    });

    forEach(get(sessions, `${session.sessionId}.offlineFns`), invoke);

    log.info(`${session.logPrefix}.onclose: Deleting stellar websocket client`, pick(session, ['sessionId']));
    delete session.client; // eslint-disable-line no-param-reassign
  }

  function onConnection(socket) {
    instrumentation.numOfConnectedClients(Date.now(), size(server.clients));
    log.info(`${stellarRequest.source} @StellarBridge: New Connection`);
    const startTime = Date.now();

    const initialSession = startSession(log, stellarRequest.source, socket);
    callHandlersSerially(_newSessionHandlers, { log, socket, session: initialSession })
      .then((session) => {
        log.info(`${session.logPrefix} Connected`, pick(session, ['sessionId']));

        socket.on('close', () => onClose(session));
        socket.on('message', str => onMessage(str, session));

        instrumentation.sessionStarted(Date.now() - startTime, session);
        const hiMessage = {
          messageType: 'connected',
          message: 'connected to stellar bridge',
          userId: session.authenticatedUserId,
          sessionId: session.sessionId };
        return socket.send(JSON.stringify(hiMessage));
      })
      .catch((e) => {
        reportError(e, initialSession);
        log.error(e, 'Connection error');
        instrumentation.sessionFailed(Date.now() - startTime);
        const errorMessage = { messageType: 'error', errorType: e.constructor.name, message: e.message, status: 401 };
        socket.send(JSON.stringify(errorMessage));
      });
  }

  server.on('connection', onConnection);
}

export default init;
