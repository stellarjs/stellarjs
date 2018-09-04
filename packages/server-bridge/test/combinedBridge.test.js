import _ from 'lodash';
import http from 'http';
import express from 'express';
import engine from 'engine.io';
import handleMessageFactory from './utils/handleMessageFactory';
import attachHttpBridgeToServer from '../src/attachHttpBridgeToServer';
import defaultStellarFactory from '../src/factories/defaultStellarFactory';
import clientFactory from '@stellarjs/client-axios';
import attachEngineIoBridgeToServer from '../src/attachEngineIoBridgeToServer';


function startServer({ errorHandler, stellarRequest }) {
  const app = express();
  const server = http.createServer(app);
  server.listen(8093);
  const httpRouter = express.Router();

  const bridgeConfig = {
    router: httpRouter,
    log: console,
    sourcePrefix: 'express-',
    stellarRequest,
    handleMessageFactory,
    errorHandlers: [errorHandler],
  };

  attachHttpBridgeToServer(bridgeConfig);
  app.use('/http', httpRouter);

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
    const stellarHttp = clientFactory({ baseURL: 'http://localhost:8093/http' }, console);

    const result = await stellarHttp.stellar.get(pingUrl);
    expect(result.text).toBe('pong-express');
    expect(result.when).toBeUndefined();
    expect(errorHandler).not.toHaveBeenCalled();
  });


  it('should bridge engine.io', async () => {
    const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
    try {
      await stellarSocket.connect('localhost:8093', { secure: false });
    } catch (e) {
      console.error(e);
    }
    const result = await stellarSocket.stellar.get(pingUrl);
    expect(result.text).toBe('pong-engineio');
    expect(result.when).toBeUndefined();
    expect(errorHandler).not.toHaveBeenCalled();
  });
});
