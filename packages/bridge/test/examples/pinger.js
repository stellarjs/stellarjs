/**
 * Created by arolave on 06/10/2016.
 */
import '../../src/server';
import { stellarAppPubSub, stellarHandler } from '@stellarjs/core'

const handler = stellarHandler();
const publisher = stellarAppPubSub();

const PUBLISH_ACTIONS = {
    CREATED: 'CREATED',
    UPDATED: 'UPDATED',
    REMOVED: 'REMOVED',
};

function kongEveryHalfSecond() {
  publisher.publish('stellarBridge:kong:stream', { text: `kong` }, { action: PUBLISH_ACTIONS.UPDATED });
  setTimeout(kongEveryHalfSecond, 500);
}

handler.get('sampleService:ping', () => ({ text: `pong` }));

handler.handleRequest('sampleService:king:subscribe', () => ({ text: `kong` }));

setTimeout(kongEveryHalfSecond, 500);
