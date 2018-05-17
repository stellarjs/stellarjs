import Promise from 'bluebird';
import url from 'url';
import assign from 'lodash/assign';
import defaults from 'lodash/defaults';
import isObject from 'lodash/isObject';
import isUndefined from 'lodash/isUndefined';
import forEach from 'lodash/forEach';
import get from 'lodash/get';
import join from 'lodash/join';
import head from 'lodash/head';
import last from 'lodash/last';
import pick from 'lodash/pick';
import size from 'lodash/size';
import split from 'lodash/split';
import uuid from 'uuid';
import jwt from 'express-jwt';

import StellarError from '@stellarjs/stellar-error';
import { WebsocketTransport } from '@stellarjs/transport-socket';
import { mwLogTraceFactory } from '@stellarjs/mw-log-trace';

function createStellarRequest(stellarFactory, middlewares, pattern) {
  const stellarRequest = stellarFactory.stellarRequest();
  const mwLogTrace = mwLogTraceFactory('HEADERS');
  stellarRequest.use(/.*/, mwLogTrace);

  if (pattern) {
    stellarRequest.use(pattern, (req, next, options) => {
      assign(req.headers, options.session.headers);
      return next();
    });
  }

  forEach(middlewares, ({ match, mw }) => stellarRequest.use(match, mw));
  return stellarRequest;
}

const sessions = {};
function startSession(log, source, socket) {
  const requestUrl = get(socket, 'request.url');
  const parsedUrl = url.parse(requestUrl, true);
  const socketId = socket.id;
  const sessionId = get(parsedUrl, 'query.x-sessionId') || socketId;

  const session = {
    source,
    sessionId,
    socketId,
    ip: get(socket, 'request.connection.remoteAddress'),
    reactiveStoppers: {},
    logPrefix: `${source} @StellarBridge(${socketId}, ${sessionId})`,
    registerStopper(channel, stopperPromise, requestId) {
      assign(session.reactiveStoppers,
        {
          [channel]: [requestId, () => {
            log.info(`${session.logPrefix}: stopped subscription`, { channel });
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
      log.info(`${session.logPrefix}: ended session`);
      delete sessions[socketId];
    }],
    setSessionHeaders(headers) {
      this.headers = assign({}, headers, { bridges: [source] });
    },
  };

  sessions[socketId] = session;  // eslint-disable-line better-mutation/no-mutation
  return session;
}

function startHttpSession(log, source, req) {
    const sessionId = uuid();
    const session = {
        source,
        sessionId,
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        logPrefix: `${source} @StellarBridge(${sessionId})`,
    };

    return session;
}


function assignClientToSession({ log, source, socket, session }) {
  return assign(session, { client: new WebsocketTransport(socket, source, log, true) });
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

function sendRequest(log, stellarRequest, session, req) {
  return stellarRequest
    ._doQueueRequest(req.headers.queueName,
                     req.body,
                     { type: req.headers.type || 'request' },
                     { responseType: 'raw', headers: req.headers, session });
}

function sendResponse(log, session, requestHeaders, res) {
  if (isUndefined(session.client)) {
    log.warn(`${session.logPrefix}: Socket was closed before response was sent.`);
    return Promise.reject(new Error('Socket was closed'));
  }

  const queueName = requestHeaders.respondTo;
  const headers = defaults({ requestId: requestHeaders.id, queueName }, res.headers);
  const obj = { headers, body: res.body };
  log.info(`${session.logPrefix} BRIDGE RESPONSE`, { queueName, obj });
  return session.client.send(obj);
}

function bridgeSubscribe(log, session, requestHeaders) {
  return ({ headers, body }) => {
    const queueName = `stlr:n:${requestHeaders.source}:subscriptionInbox`; // queueName hard coded from StellarPubSub pattern
    const socketHeaders = defaults({ queueName }, headers);
    const obj = { headers: socketHeaders, body };

    log.info(`${session.logPrefix} BRIDGE SUBSCRIBE`, { queueName, obj });
    return session.client.send(obj);
  };
}

function subscribe(log, stellarRequest, session, req) {
  const stopper = head(session.reactiveStoppers[req.headers.channel]);
  if (stopper) {
    const message = `Multiple subscriptions to same channel (${
      req.headers.channel}) not supported. First subscription sent ${stopper}`;

    log.warn(session.logPrefix, message);
    const errorResponse = stellarRequest._prepareResponse(req, new StellarError(message));
    return sendResponse(log, session, req.headers, errorResponse);
  }

  const onStop = stellarRequest.pubsub.subscribe(req.headers.channel,
                                                 bridgeSubscribe(log, session, req.headers),
                                                 { responseType: 'raw', session });

  session.registerStopper(req.headers.channel, onStop, req.headers.id);
  return Promise.resolve(true);
}

function request(log, stellarRequest, session, req) {
  return sendRequest(log, stellarRequest, session, req)
    .then(response => sendResponse(log, session, req.headers, response));
}

function handleMessage(log, stellarRequest, session, req) {
  switch (req.headers.type) {
    case 'request': {
      return request(log, stellarRequest, session, req);
    }
    case 'fireAndForget': {
      return sendRequest(log, stellarRequest, session, req);
    }
    case 'subscribe': {
      return subscribe(log, stellarRequest, session, req);
    }
    case 'reactive': {
      return Promise.all([
        request(log, stellarRequest, session, req),
        subscribe(log, stellarRequest, session, req)]);
    }
    case 'stopReactive': {
      const stopper = last(session.reactiveStoppers[req.headers.channel]);
      if (stopper) {
        return stopper();
      }

      return Promise.resolve(false);
    }
    default: {
      throw new Error(`Invalid stellar bridge message: ${JSON.stringify(req)}`);
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
                router,
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
        .try(() => handleMessage(log, stellarRequest, session, command.data))
        .then(() => instrumentation.done())
        .catch((e) => {
          instrumentation.done(e);
          reportError(e, session, command);
        });
    });
  }

  function onClose(session) {
    log.error(`${session.logPrefix}: onClose`);
    instrumentation.numOfConnectedClients(Date.now(), size(server.clients));
    forEach(session.reactiveStoppers, (stopper, channel) => {
      if (last(stopper)) {
        last(stopper)();
      } else {
        log.error(`${session.logPrefix}: Unable to find stopper for ${channel}`,
                  { sessionId: session.sessionId, channel });
      }
    });

    const offlineFns = get(sessions, `${session.socketId}.offlineFns`);
    forEach(offlineFns, fn => fn());

    log.info(`${session.logPrefix}.onclose: Deleting stellar websocket client`, pick(session, ['sessionId']));
    delete session.client; // eslint-disable-line no-param-reassign
  }

  function onConnection(socket) {
    instrumentation.numOfConnectedClients(Date.now(), size(server.clients));
    log.info(`${stellarRequest.source} @StellarBridge: New Connection`);
    const startTime = Date.now();

    const initialSession = startSession(log, stellarRequest.source, socket);
    socket.on('error', () => log.info(`${initialSession.logPrefix} Error`));

    const initialOnClose = () => onClose(initialSession);
    socket.on('close', initialOnClose);
    callHandlersSerially(_newSessionHandlers, { source: stellarRequest.source, log, socket, session: initialSession })
      .then((session) => {
        log.info(`${session.logPrefix} Connected`, pick(session, ['sessionId']));

        socket.removeListener('close', initialOnClose);
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
        log.error(e, `${initialSession.logPrefix} Connection error`);
        instrumentation.sessionFailed(Date.now() - startTime);
        const errorMessage = { messageType: 'error', errorType: e.constructor.name, message: e.message, status: 401 };
        socket.send(JSON.stringify(errorMessage));
      });
  }

  async function onHttpRequest(req, res) {
    const { body: { body }, params, user } = req;
    const queueName = join(split(params[0], '/'), ':');
    const initSession = startHttpSession(log, stellarRequest.source, req);
    const command = { headers: { queueName, type: 'request', ...user }, body };

    const response = await new Promise((resolve, reject) => {
        instrumentation.startTransaction(getTxName({ queueName }), initSession, async () => {
        const response =  await sendRequest(log, stellarRequest, initSession, command);
        instrumentation.done();
        resolve(response);
        });
    });

    res.send(response);
  }

  server.on('connection', onConnection);
  router.use(jwt({ secret: 'not so secret'}));
  router.post('/stellarRequest/*', onHttpRequest)
}

export default init;
