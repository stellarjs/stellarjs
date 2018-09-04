import bodyParser from 'body-parser';

import join from 'lodash/join';
import trim from 'lodash/trim';
import split from 'lodash/split';
import nanoid from 'nanoid';

import defaultSendResponseFactory from './factories/httpSendResponseFactory';
import getTxName from './getTxName';
import configureTaskHandlers from './configureTaskHandlers';

export default function attachHttpBridgeToServer(config) {
  const { router, basePath = '' } = config;

  const {
    stellarRequest,
    startSession,
    callHandlersSerially,
    handleMessage,
    sendResponse,
    reportError,
    instrumentation } = configureTaskHandlers(config, defaultSendResponseFactory);

  function handleProcessingError(e, session, command, next) {
    instrumentation.done(e);
    reportError(e, session, command);

    if (!command.headers) {
      next(e);
    }

    const errorResponse = stellarRequest._prepareResponse(command, e);
    sendResponse(session, command.headers, errorResponse);
  }

  function callHandleMessage(session, command, next) {
    return handleMessage(session, command)
      .then(() => instrumentation.done())
      .catch(e => handleProcessingError(e, session, command, next));
  }

  function onHttpRequest(req, res, next) {
    const { body: { body, headers }, params } = req;
    const queueName = join(split(params[0], '/'), ':');

    const initialSession = startSession(req, { defaultSessionId: nanoid(), client: res });

    const command = { headers, body };

    return instrumentation.startTransaction(getTxName({ queueName }), initialSession, () =>
      callHandlersSerially({
        session: initialSession,
        request: req,
      })
        .then(session => callHandleMessage(session, command, next))
        .catch(e => handleProcessingError(e, initialSession, command, next))
    );
  }

  router.use(bodyParser.json());

  const trimmedBasePath = trim(basePath);
  const routerPattern = trimmedBasePath.length ? `/${trimmedBasePath}/*` : '/*';
  router.post(routerPattern, onHttpRequest);
}
