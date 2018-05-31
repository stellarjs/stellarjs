/**
 * Created by arolave on 06/10/2016.
 */
import StellarError from '@stellarjs/stellar-error';
import { stellarAppPubSub, stellarHandler } from '@stellarjs/core';
import url from 'url';
import omit from 'lodash/omit';
import Promise from 'bluebird';

import defaultStellarFactory from '../../src/lib/defaultStellarFactory';
import { boot } from '../../src';

const log = console;
const stellarFactory = defaultStellarFactory(log);

let server = null;
function start() {
  server = boot({
    attachHttp: true,
    secret: 'not so secret',
    stellarFactory,
    instrumentation,
    newSessionHandlers: [
      ({ log, socket, session }) => {

        if (!socket) {
          return;
        }

        const request = socket.request;
        const parsedUrl = url.parse(request.url, true);
        const userId = parsedUrl.query['x-auth-user'];
        const queryParams =
            parsedUrl.query;

        if (userId === '3') {
          throw new StellarError('Authentication Error');
        } else if (userId === '4') {
          throw new Error('Other Error');
        }

        console.info(`QueryParams: ${JSON.stringify(queryParams)}`);
        Object.assign(session, omit(queryParams, ['x-auth-user', 'x-auth-token', 'x-auth-token-type']),
            { authenticatedUserId: userId });
        return session;
      },
    ],
  });
}
export { start, handler };
