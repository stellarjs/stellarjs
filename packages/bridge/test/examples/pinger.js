/**
 * Created by arolave on 06/10/2016.
 */
import { stellarAppPubSub, stellarHandler, StellarError } from '@stellarjs/core'
import url from 'url';

import boot from '../../src/bootstrap';
import bridgeInit from '../../src/server';

const server = boot();
bridgeInit({
             server,
             newSessionHandlers: [
               ({ log, socket, session }) => {
                const request = socket.request;
                const parsedUrl = url.parse(request.url, true);
                const userId = parsedUrl.query['x-auth-user'];

                if (userId === '3') {
                  throw new StellarError('Authentication Error');
                } else if (userId === '4') {
                  throw new Error('Other Error');
                }

                return session;
              },
             ],
});

const PUBLISH_ACTIONS = {
    CREATED: 'CREATED',
    UPDATED: 'UPDATED',
    REMOVED: 'REMOVED',
};
const publisher = stellarAppPubSub();
function kongEveryHalfSecond() {
  publisher.publish('stellarBridge:kong:stream', { text: `kong` }, { action: PUBLISH_ACTIONS.UPDATED });
  setTimeout(kongEveryHalfSecond, 500);
}

const handler = stellarHandler();
handler.get('sampleService:ping', () => ({ text: `pong` }));
handler.handleRequest('sampleService:king:subscribe', () => ({ text: `kong` }));

setTimeout(kongEveryHalfSecond, 500);

