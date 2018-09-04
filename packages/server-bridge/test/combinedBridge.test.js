import _ from 'lodash';
import http from 'http';
import express from 'express';
import engine from 'engine.io';
import httpClient from '@stellarjs/client-axios';
import { stellarSocket } from '@stellarjs/client-engine.io';

import handleMessageFactory from './utils/handleMessageFactory';
import attachHttpBridgeToServer from '../src/attachHttpBridgeToServer';
import defaultStellarFactory from '../src/factories/defaultStellarFactory';
import attachEngineIoBridgeToServer from '../src/attachEngineIoBridgeToServer';

const PORT = 8095;

function startServer({ errorHandler }) {
  const app = express();
  const server = http.createServer(app).listen(PORT);

  // http server
  const httpRouter = express.Router();
  attachHttpBridgeToServer({
    router: httpRouter,
    log: console,
    sourcePrefix: 'express-',
    handleMessageFactory,
    errorHandlers: [errorHandler],
  });
  app.use('/http', httpRouter);

  // engine.io server
  const engineIoServer = engine.attach(server, { transports: ['websocket', 'polling'] }, () => {
    console.info('@Bridge: Server is running');
  });
  attachEngineIoBridgeToServer({
    server: engineIoServer,
    sourcePrefix: 'engineio-',
    log: console,
    errorHandlers: [errorHandler],
    handleMessageFactory,
  });
}

describe('Combined Engineio/Http Bridge', () => {
  let errorHandler;
  let server;
  const pingUrl = `${Date.now()}:ping`;

  beforeAll(async () => {
    errorHandler = jest.fn();
    server = startServer({ errorHandler });

    const stellarFactory = defaultStellarFactory({ log: console });
    const handler = stellarFactory.stellarHandler();
    handler.get(pingUrl, ({ headers, body }) => ({
      text: `pong-${_.first(_.split(_.trimStart(headers.respondTo, 'stlr:n:'), '-'))}`,
      what: headers.what,
    }));
  });

  afterEach(() => {
    errorHandler.mockReset();
  });


  afterAll(async () => {
    server.close();
  });

  it('should bridge http', async () => {
    const stellarHttp = httpClient({ baseURL: `http://localhost:${PORT}/http` }, console);

    const result = await stellarHttp.stellar.get(pingUrl);
    expect(result.text).toBe('pong-express');
    expect(result.when).toBeUndefined();
    expect(errorHandler).not.toHaveBeenCalled();
  });


  it('should bridge engine.io', async () => {
    const socketClient = stellarSocket();
    try {
      await socketClient.connect(`localhost:${PORT}`, { secure: false });
    } catch (e) {
      console.error(e);
    }
    const result = await socketClient.stellar.get(pingUrl);
    expect(result.text).toBe('pong-engineio');
    expect(result.when).toBeUndefined();
    expect(errorHandler).not.toHaveBeenCalled();
  });
});
