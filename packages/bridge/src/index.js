/**
 * Created by arolave on 21/06/2017.
 */
import engine from 'engine.io';
import assign from 'lodash/assign';

import attach from './bridge';

function boot(config = {}) {
  const log = config.log || console;
  const port = process.env.PORT || 8091;
  log.info(`Start initializing server on port ${port}`);
  const server = engine.listen(port, { transports: ['websocket', 'polling'] }, () => {
    log.info('@StellarBridge: Server is running');
  });

  const originalHandler = server.handleRequest.bind(server);
  server.handleRequest = function handleRequest(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    originalHandler(req, res);
  };

  attach(assign(config, { server }));
  return server;
}

export default { boot, attach };
