/**
 * Created by arolave on 06/10/2016.
 */
import { stellarAppPubSub, stellarHandler, StellarError } from '@stellarjs/core';
import url from 'url';
import omit from 'lodash/omit';


import defaultStellarFactory from '../../src/defaultStellarFactory';
import { boot } from '../../src';

const log = console;
const stellarFactory = defaultStellarFactory(log);

let server = null;
function start() {
    server = boot({
                      stellarFactory,
                      newSessionHandlers: [
                          ({ log, socket, session }) => {
                              const request = socket.request;
                              const parsedUrl = url.parse(request.url, true);
                              const userId = parsedUrl.query['x-auth-user'];
                              const queryParams = parsedUrl.query;

                              if (userId === '3') {
                                  throw new StellarError('Authentication Error');
                              } else if (userId === '4') {
                                  throw new Error('Other Error');
                              }

                              console.info(`QueryParams: ${JSON.stringify(queryParams)}`);
                              Object.assign(session, omit(queryParams, ['x-auth-user', 'x-auth-token', 'x-auth-token-type']));
                              return session;
                          },
                      ],
                  });
}

function shutdown() {
    server.close();
}

const PUBLISH_ACTIONS = {
    CREATED: 'CREATED',
    UPDATED: 'UPDATED',
    REMOVED: 'REMOVED',
};
const publisher = stellarFactory.stellarAppPubSub();
function kongEveryHalfSecond() {
    publisher.publish('stellarBridge:kong:stream', { text: `kong` }, { action: PUBLISH_ACTIONS.UPDATED });
    setTimeout(kongEveryHalfSecond, 500);
}

const handler = stellarFactory.stellarHandler();
handler.get('sampleService:ping', () => ({ text: `pong` }));
handler.get('sampleService:pingError', () => {
    throw new Error('pongError');
});
handler.handleRequest('sampleService:king:subscribe', () => ({ text: `kong` }));

setTimeout(kongEveryHalfSecond, 500);

export { start, shutdown };
