/**
 * Created by arolave on 06/10/2016.
 */
import '../../src/server';
import { stellarAppPubSub, stellarHandler } from '@stellarjs/core'

const handler = stellarHandler();
const publish = stellarAppPubSub();

const PUBLISH_ACTIONS = {
    CREATED: 'CREATED',
    UPDATED: 'UPDATED',
    REMOVED: 'REMOVED',
};

// function kongEverySecond() {
//     publish('stellarBridge:kong:stream', { text: `kong` }, { action: PUBLISH_ACTIONS.UPDATED });
//     setTimeout(kongEverySecond, 10000);
// }

handler.get('stellarBridge:ping', () => ({ text: `pong` }));

handler.handleRequest('stellarBridge:king:subscribe', () => ({ text: `kong` }));

// setTimeout(kongEverySecond, 2000);
