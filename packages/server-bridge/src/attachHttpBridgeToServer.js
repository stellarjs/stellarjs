import bodyParser from 'body-parser';

import join from 'lodash/join';
import split from 'lodash/split';
import nanoid from 'nanoid';

import defaultHandleMessageFactory from './factories/handleMessageFactory';
import defaultReportErrorFactory from './factories/reportErrorFactory';
import defaultSendResponseFactory from './factories/httpSendResponseFactory';
import defaultStartSessionFactory from './factories/startSessionFactory';
import defaultCallHandlersSeriallyFactory from './factories/callHandlersSeriallyFactory';
import getTxName from './getTxName';
import getConfigWithDefaults from './getConfigWithDefaults';

export default function attachHttpBridgeToServer(originalConfig) {
  const config = getConfigWithDefaults(originalConfig);
  const {
    router,
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
  router.post('/stellarRequest/*', onHttpRequest);
}
