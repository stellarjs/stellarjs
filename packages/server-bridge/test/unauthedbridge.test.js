import _ from 'lodash';
import express from 'express';
import http from 'http';
import clientFactory from '@gf-stellarjs/client-axios';

import attachHttpBridgeToServer from '../src/attachHttpBridgeToServer';
import handleMessageFactory from './utils/handleMessageFactory';
import defaultStellarFactory from '../src/factories/defaultStellarFactory';

describe('Simple Http Bridge', () => {
  const errorHandler = jest.fn();
  const pingUrl = `${Date.now()}:ping`;
  const configs = [{ port: 8093 }, { port: 8094, sourcePrefix: 'bridge2-', basePath: 'stellarRequest' }];

  beforeAll(() => {
    _.map(configs, (config) => {
      const app = express();
      const server = http.Server(app);
      server.listen(config.port);

      const bridgeConfig = {
        router: app,
        log: console,
        errorHandlers: [errorHandler],
        handleMessageFactory,
        ...config,
      };

      return attachHttpBridgeToServer(bridgeConfig);
    });

    const stellarFactory = defaultStellarFactory({ log: console });
    const handler = stellarFactory.stellarHandler();
    handler.get(pingUrl, ({ headers, body }) => ({
      text: `pong`,
      what: headers.what,
    }));
  });

  afterEach(() => {
    errorHandler.mockReset();
  });

  it('should bridge request response without jwt headers', async () => {
    const stellarHttp = clientFactory({ baseURL: 'http://localhost:8093/blah' }, console);

    const result = await stellarHttp.stellar.get(pingUrl);
    expect(result.text).toBe('pong');
    expect(result.when).toBeUndefined();
    expect(errorHandler).not.toHaveBeenCalled();
  });

  it('should only route from a configured basepath', async () => {
    const stellarHttp = clientFactory({ baseURL: `http://localhost:${configs[1].port}/stellarRequest` }, console);

    const result = await stellarHttp.stellar.get(pingUrl);
    expect(result.text).toBe('pong');
    expect(result.when).toBeUndefined();
    expect(errorHandler).not.toHaveBeenCalled();
  });

  it('should fail if basepath fails', async () => {
    const stellarHttp = clientFactory({ baseURL: `http://localhost:${configs[1].port}/blahblah` }, console);

    try {
      await stellarHttp.stellar.get(pingUrl);
      fail('should throw 404');
    } catch(e) {
      expect(e).toEqual(new Error('Request failed with status code 404'));
    }
  });
});
