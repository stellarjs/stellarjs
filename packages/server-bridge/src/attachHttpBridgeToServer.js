import jwt from 'express-jwt';
import bodyParser from 'body-parser';

import split from 'lodash/split';
import join from 'lodash/join';
import assign from 'lodash/assign';

import instrumentationMockFactory from './factories/instrumentationMockFactory';
import startSessionFactory from './factories/startSessionFactory';
import stellarRequestFactory from './factories/stellarRequestFactory';
import handleMessageFactory from './factories/handleMessageFactory';
import getTxNameFactory from './factories/getTxNameFactory';
import callHandlersSeriallyFactory from './factories/callHandlersSeriallyFactory';

function assignClientToSession({ log, source, socket, session }) {
    return assign(session, { client: 'http' });
}

export default function attachHttpBridgeToServer(config) {
  const {
        router,
        secret,
        log,
        instrumentation = instrumentationMockFactory(config),
        newSessionHandlers = [],
    } = config;

  const stellarRequest = stellarRequestFactory(config);
  const startSession = startSessionFactory(config);
  const handleMessage = handleMessageFactory(config);
  const getTxName = getTxNameFactory(config);
  const callHandlersSerially = callHandlersSeriallyFactory(config);

  async function onHttpRequest(req, res) {
    const { body: { body }, params, user } = req;
    const queueName = join(split(params[0], '/'), ':');

    const initialSession = startSession({
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    }, { log, source: stellarRequest.source });

    const command = { headers: { queueName, type: 'request', ...user }, body };

      const _newSessionHandlers = [assignClientToSession].concat(newSessionHandlers);
    const session = await callHandlersSerially(_newSessionHandlers,
      {
        log,
        source: stellarRequest.source,
        session: initialSession,
      });
        // eslint-disable-next-line promise/avoid-new
    const responePayload = await new Promise((resolve) => {
      instrumentation.startTransaction(getTxName({ queueName }), session, async () => {
        const response = await handleMessage(stellarRequest, session, command);
        instrumentation.done();
        resolve(response);
      });
    });

    res.send(responePayload);
  }


  router.use(bodyParser.json());
  router.use(jwt({ secret }));
  router.post('/stellarRequest/*', onHttpRequest);
}
