import express from 'express';
import http from 'http';
import clientFactory from '@stellarjs/client-axios';

import attachHttpBridgeToServer from '../src/attachHttpBridgeToServer';
import handleMessageFactory from './utils/handleMessageFactory';
import defaultStellarFactory from '../src/factories/defaultStellarFactory';

describe('Unauthed Bridge', () => {

  let errorHandler = jest.fn();
  const pingUrl = `${Date.now()}:ping`;
  
  beforeAll(() => {
    const app = express();
    const server = http.Server(app);
    server.listen(8093);

    const stellarFactory = defaultStellarFactory({ log: console });
    const handler = stellarFactory.stellarHandler();

    attachHttpBridgeToServer({
                               router: app,
                               log: console,
                               errorHandlers: [errorHandler],
                               handleMessageFactory
                             });

    handler.get(pingUrl, ({ headers, body }) => {
      return {
        text: `pong`,
        what: headers.what,
      };
    });
  });

  afterEach(() => {
    errorHandler.mockReset();
  });

  it('should bridge request response without jwt headers', async () => {
    const stellarHttp = clientFactory({ baseURL: 'http://localhost:8093/stellarRequest' }, console);

    const result = await stellarHttp.stellar.get(pingUrl);
    expect(result.text).toBe('pong');
    expect(result.when).toBeUndefined();
    expect(errorHandler).not.toHaveBeenCalled();
  });
});