/**
 * Created by arolave on 21/06/2017.
 */
import engine from 'engine.io';
import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';
import assign from 'lodash/assign';

import defaultStellarFactory from './defaultStellarFactory';
import attachToServer from './bridge';

function boot(config = {}) {
  const log = config.log || console;
  const port = process.env.PORT || config.port || 8091;
  log.info('@Bridge: Start initializing server', { port });

  const app = express();
  const server = http.Server(app);

  app.use(bodyParser.json());
  const socketServer = engine.attach(server, { transports: ['websocket', 'polling'] }, () => {
    log.info('@Bridge: Server is running');
  });

  server.listen(port);

  const originalHandler = socketServer.handleRequest.bind(socketServer);
  // eslint-disable-next-line better-mutation/no-mutation
    socketServer.handleRequest = function handleRequest(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    originalHandler(req, res);
  };

  const finalConfig = { server: socketServer, router: app };
  if (!config.stellarFactory) {
    assign(finalConfig, { stellarFactory: defaultStellarFactory(log) });
  }

  attachToServer(assign(finalConfig, config));
  return socketServer;
}

export { boot, attachToServer };
