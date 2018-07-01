import jwt from 'express-jwt';
import bodyParser from 'body-parser';

import join from 'lodash/join';
import split from 'lodash/split';
import uuid from 'uuid/v4';

import defaultHandleMessageFactory from './factories/handleMessageFactory';
import defaultReportErrorFactory from './factories/reportErrorFactory';
import defaultSendResponseFactory from './factories/httpSendResponseFactory';
import defaultStartSessionFactory from './factories/startSessionFactory';
import defaultCallHandlersSeriallyFactory from './factories/callHandlersSeriallyFactory';
import getTxName from './getTxName';
import getConfigWithDefaults from './getConfigWithDefaults';
import Promise from 'bluebird';

export default function attachHttpBridgeToServer(originalConfig) {
  const config = getConfigWithDefaults(originalConfig);
  const {
        router,
        secret,
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

  async function onHttpRequest(req, res) {
    const { body: { body }, params, user } = req;
    const queueName = join(split(params[0], '/'), ':');

    const initialSession = startSession(req, { defaultSessionId: uuid(), client: res });

    const command = { headers: { queueName, type: 'request', ...user }, body };

    const session = await callHandlersSerially({
      source: stellarRequest.source,
      session: initialSession,
    });

    instrumentation.startTransaction(getTxName({ queueName }), session, () => {
      Promise
        .try(() => handleMessage(session, command))
        .then(() => instrumentation.done())
        .catch((e) => {
          const errorResponse = stellarRequest._prepareResponse(command, e);
          sendResponse(session, command.headers, errorResponse);
          instrumentation.done(e);
          reportError(e, session, command);
        });
    });
  }


  router.use(bodyParser.json());
  router.use(jwt({ secret }));
  router.post('/stellarRequest/*', onHttpRequest);
}
