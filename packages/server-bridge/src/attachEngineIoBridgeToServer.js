import forEach from 'lodash/forEach';
import invoke from 'lodash/invoke';
import last from 'lodash/last';
import size from 'lodash/size';
import { WebsocketTransport } from '@stellarjs/transport-socket';

import defaultStartSessionFactory from './factories/startSessionFactory';
import defaultHandleMessageFactory from './factories/handleMessageFactory';
import defaultReportErrorFactory from './factories/reportErrorFactory';
import defaultSendResponseFactory from './factories/socketSendResponseFactory';
import defaultCallHandlersSeriallyFactory from './factories/callHandlersSeriallyFactory';
import getTxName from './getTxName';
import getConfigWithDefaults from './getConfigWithDefaults';

export default function attachEngineIoBridgeToServer(originalConfig) {
  const config = getConfigWithDefaults(originalConfig);
  const {
    server,
    log,
    instrumentation,
    stellarRequest,
    reportErrorFactory = defaultReportErrorFactory,
    startSessionFactory = defaultStartSessionFactory,
    handleMessageFactory = defaultHandleMessageFactory,
    callHandlersSeriallyFactory = defaultCallHandlersSeriallyFactory,
    sendResponseFactory = defaultSendResponseFactory,
  } = config;

  const reportError = reportErrorFactory(config);
  const startSession = startSessionFactory(config);
  const callHandlersSerially = callHandlersSeriallyFactory(config);
  const sendResponse = sendResponseFactory(config);
  const handleMessage = handleMessageFactory({ ...config, sendResponse });

  const sessions = {};
  function onClose(session) {
    log.info(`onClose`, session.logContext);
    instrumentation.numOfConnectedClients(Date.now(), size(server.clients));
    forEach(session.reactiveStoppers, (stopper, channel) => {
      if (last(stopper)) {
        last(stopper)();
      } else {
        log.error(`Unable to find stopper for ${channel}`, { channel, ...session.logContext });
      }
    });

    delete session.client; // eslint-disable-line no-param-reassign
    delete sessions[session.socketId]; // eslint-disable-line no-param-reassign
    invoke(session, 'offlineFn');

    log.info(`onclose: Deleting stellar websocket client`, session.logContext);
  }

  function onMessage(str, session) {
    let command = null;
    try {
      command = JSON.parse(str);
    } catch (e) {
      reportError(e, session, str);
      return;
    }

    const req = command.data;

    instrumentation.startTransaction(getTxName(req.headers), session, () => {
      handleMessage(session, req)
        .then(() => instrumentation.done())
        .catch((e) => {
          const errorResponse = stellarRequest._prepareResponse(req, e);
          sendResponse(session, req.headers, errorResponse);
          instrumentation.done(e);
          reportError(e, session, command);
        });
    });
  }

  function onConnection(socket) {
    instrumentation.numOfConnectedClients(Date.now(), size(server.clients));
    log.info(`${stellarRequest.source} @StellarBridge: New Connection`);

    const socketSession = {
      socketId: socket.id,
      defaultSessionId: socket.id,
      client: new WebsocketTransport(socket, stellarRequest.source, log, true),
    };

    const initialSession = startSession(socket.request, socketSession);

    socket.on('error', () => log.info(`Error`, initialSession.logContext));

    const initialOnClose = () => onClose(initialSession);
    socket.on('close', initialOnClose);

    callHandlersSerially({ request: socket.request, session: initialSession })
      .then((session) => {
        sessions[socket.id] = session; // eslint-disable-line better-mutation/no-mutation
        log.info(`Connected`, session.logContext);

        socket.removeListener('close', initialOnClose);
        socket.on('close', () => onClose(session));
        socket.on('message', str => onMessage(str, session));

        instrumentation.sessionStarted(Date.now() - session.startTime, session);
        const hiMessage = {
          messageType: 'connected',
          message: 'connected to stellar bridge',
          userId: session.authenticatedUserId,
          sessionId: session.sessionId };
        return socket.send(JSON.stringify(hiMessage));
      })
      .catch((e) => {
        reportError(e, initialSession);
        log.error(e, `Connection error`, initialSession.logContext);
        instrumentation.sessionFailed(Date.now() - initialSession.startTime);
        const errorMessage = { messageType: 'error', errorType: e.constructor.name, message: e.message, status: 401 };
        socket.send(JSON.stringify(errorMessage));
      });
  }

  server.on('connection', onConnection);
}
