import _ from 'lodash';
import Promise from 'bluebird';
import RedisClient from '@gf-stellarjs/transport-bull/lib-es6/config-redisclient';
import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import nanoid from 'nanoid';
import clientFactory from '@gf-stellarjs/client-axios';
import StellarError from '@gf-stellarjs/stellar-error';

import defaultStellarFactory from '../src/factories/defaultStellarFactory';
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
  const errorHandler = jest.fn();
  const pingUrl = `${Date.now()}:ping`;

  function extractToken(req) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length != 2) {
      throw new Error('credentials_bad_format', { message: 'Format is Authorization: Bearer [token]' });
    }

    const [scheme, credentials] = parts;
    if (!/^Bearer$/i.test(scheme)) {
      throw new Error('credentials_bad_scheme', { message: 'Format is Authorization: Bearer [token]' });
    }

    return credentials;
  }

  function checkJwtRevoked(payload) {
    console.log('checkJwtRevoked', payload);
  }

  beforeAll(async () => {
    await clearRedis(redisClient);

    const app = express();
    const server = http.Server(app).listen(8092);

    attachHttpBridgeToServer({
      router: app,
      secret,
      log: console,
      errorHandlers: [errorHandler],
      handleMessageFactory,
      newSessionHandlers: [
        async ({ log, request, session }) => {
          const token = extractToken(request);
          try {
            const decoded = await jwt.verify(token, secret);
            await checkJwtRevoked(decoded);
            return { headers: _.pick(decoded, 'what') };
          } catch (err) {
            throw new StellarError(`Authentication Error ${err.message}`);
          }
        },
      ],
    });

    handler.get(pingUrl, ({ headers, body }) => ({
      text: `pong`,
      whatRequest: headers.what,
    }));
  });

  afterEach(async () => {
    await Promise.delay(100);
    errorHandler.mockReset();
  });

  afterAll(async () => {
    redisClient.defaultConnection.quit();
    return redisClient.closeAll();
  });

  describe('axios server call', () => {
    it('send invalid request to http bridge', async () => {
      const headers = {
        userId: nanoid(),
        what: 'ever',
      };

      const token = jwt.sign(headers, secret);

      const httpUrl = `http://localhost:8092/stellarRequest/${pingUrl.replace(/:/, '/')}/get`;
      try {
        await axios.post(httpUrl, { body: 'ping' }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        fail();
      } catch (e) {
        expect(e.response.status).toEqual(500);
        expect(errorHandler).toHaveBeenCalled();
      }
    });

    it('http client using http bridge', async () => {
      const headers = {
        userId: nanoid(),
        what: 'ever',
      };

      const token = jwt.sign(headers, secret);

      const httpUrl = `http://localhost:8092/stellarRequest/${pingUrl.replace(/:/, '/')}/get`;
      const { data } = await axios.post(httpUrl, { body: 'ping', headers: { queueName: `${pingUrl}:get`, type: 'request', id: '1' } }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(data.body.text).toBe('pong');
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe('Authed HTTP Bridge', () => {
    it('should fail with auth error if no jwt headers', async () => {
      const stellarHttp = clientFactory({ baseURL: 'http://localhost:8092/stellarRequest' }, console);

      try {
        const result = await stellarHttp.stellar.get(pingUrl);
        fail();
      } catch (e) {
        expect(e).toBeInstanceOf(StellarError);
        expect(e.message).toEqual('Authentication Error jwt malformed');
        // expect(errorHandler).toHaveBeenCalled();
      }
    });

    it('should bridge request response with jwt headers', async () => {
      const originalHeaders = {
        what: 'ever',
      };

      const token = jwt.sign(originalHeaders, secret);

      const stellarHttp = clientFactory({ token, baseURL: 'http://localhost:8092/stellarRequest' }, console);

      const result = await stellarHttp.stellar.get(pingUrl);
      expect(result.text).toBe('pong');
      expect(result.whatRequest).toBe('ever');
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('should raise an Authentication exception of the token is invalid', async () => {
      const originalHeaders = {
        what: 'ever',
      };

      const token = jwt.sign(originalHeaders, 'not the secret');
      const stellarHttp = clientFactory({ token, baseURL: 'http://localhost:8092/stellarRequest' }, console);

      try {
        await stellarHttp.stellar.get('sampleService:ping');
        fail();
      } catch (e) {
        expect(e).toBeInstanceOf(StellarError);
        expect(e.message).toEqual('Authentication Error invalid signature');
        // expect(errorHandler).toHaveBeenCalled();
      }
    });

    it('should report bridge messageHandling errors', async () => {
      const originalHeaders = {
        what: 'ever',
      };

      const token = jwt.sign(originalHeaders, secret);
      const stellarHttp = clientFactory({ token, baseURL: 'http://localhost:8092/stellarRequest' }, console);

      try {
        await stellarHttp.stellar.get('sampleService:ping', {}, { headers: { fakeHandleMessageError: true } });
        fail();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(errorHandler).toHaveBeenCalled();
      }
    });
  });
});
