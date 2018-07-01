import Promise from 'bluebird';
import _ from 'lodash';
import RedisClient from '@stellarjs/transport-bull/lib-es6/config-redisclient';
import defaultStellarFactory from '../src/factories/defaultStellarFactory';
import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import uuid from 'uuid';
import clientFactory from '@stellarjs/client-axios';

import attachHttpBridgeToServer from '../src/attachHttpBridgeToServer';
import handleMessageFactory from './utils/handleMessageFactory';

const clearRedis = (redisClient) => {
  redisClient = new RedisClient(console);
  if (redisClient.defaultConnection.options.db === 7) {
    console.info('Flush redis');
    return redisClient.defaultConnection.flushdb();
  }
  throw new Error('Redis not in test mode');
};

describe('attachHttpBridgeToServer', () => {
  let redisClient;
  const secret = 'not so secret';
  const stellarFactory = defaultStellarFactory({ log: console });
  const handler = stellarFactory.stellarHandler();
  let errorHandler = jest.fn();
  const pingUrl = `${uuid()}:ping`;

  beforeAll(async () => {
    await clearRedis(redisClient);
    const port = 8092;
    console.info('@Bridge: Start initializing server', { port });

    const app = express();
    const server = http.Server(app);
    server.listen(port);

    attachHttpBridgeToServer({
                               router: app,
                               secret,
                               log: console,
                               errorHandlers: [errorHandler],
                               handleMessageFactory,
                             });

    handler.get(pingUrl, ({ headers, body }) => {
      return {
        text: `pong`,
      };
    });
  });

  afterEach(async () => {
    await Promise.delay(100);
    errorHandler.mockReset();
  });

  afterAll(async () => {
    redisClient.defaultConnection.quit();
    return redisClient.closeAll();
  });

  describe('call server', () => {
    it('request response using http bridge', async () => {
      const originalHeaders = {
        userId: uuid(),
        operationId: uuid(),
        what: 'ever',
      };

      const token = jwt.sign(originalHeaders, secret);

      const stellarHttp = clientFactory({ token, baseUrl: 'http://localhost:8092/stellarRequest' }, console);

      const result = await stellarHttp.stellar.get(pingUrl);
      expect(result.text).toBe('pong');
      expect(errorHandler).not.toHaveBeenCalled();
    });


    it('should report bridge messageHandling errors', async () => {
      const originalHeaders = {
        userId: uuid(),
        operationId: uuid(),
        what: 'ever',
      };

      const token = jwt.sign(originalHeaders, secret);
      const stellarHttp = clientFactory({ token, baseUrl: 'http://localhost:8092/stellarRequest' }, console);

      try {
        await stellarHttp.stellar.get('sampleService:ping', {}, { headers: { fakeHandleMessageError: true} });
        fail();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(errorHandler).toHaveBeenCalled();
      }
    });
  });
});
