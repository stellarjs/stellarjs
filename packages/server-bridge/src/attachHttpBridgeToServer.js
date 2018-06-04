import jwt from 'express-jwt';
import bodyParser from 'body-parser';

import split from 'lodash/split';
import join from 'lodash/join';
import assign from 'lodash/assign';

import startSessionFactory from './factories/startSessionFactory';
import handleMessageFactory from './factories/handleMessageFactory';
import getTxName from './getTxName';
import callHandlersSeriallyFactory from './factories/callHandlersSeriallyFactory';
import getConfigWithDefaults from './getConfigWithDefaults';

function assignClientToSession({ session }) {
  return assign(session, { client: 'http' });
}

export default function attachHttpBridgeToServer(originalConfig) {
  const config = getConfigWithDefaults(originalConfig);
  const {
        router,
        secret,
        instrumentation,
        newSessionHandlers,
        stellarRequest,
    } = config;

  const startSession = startSessionFactory(config);
  const handleMessage = handleMessageFactory(config);
  const callHandlersSerially = callHandlersSeriallyFactory(config);

  async function onHttpRequest(req, res) {
    const { body: { body }, params, user } = req;
    const queueName = join(split(params[0], '/'), ':');

    const initialSession = startSession({
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    }, { source: stellarRequest.source });

    const command = { headers: { queueName, type: 'request', ...user }, body };

    const _newSessionHandlers = [assignClientToSession].concat(newSessionHandlers);
    const session = await callHandlersSerially(_newSessionHandlers,
      {
        source: stellarRequest.source,
        session: initialSession,
      });
        // eslint-disable-next-line promise/avoid-new
    const responePayload = await new Promise((resolve) => {
      instrumentation.startTransaction(getTxName({ queueName }), session, async () => {
        const response = await handleMessage(session, command);
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
