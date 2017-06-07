/**
 * Created by arolave on 06/10/2016.
 */

import { transportFactory, configureStellar } from '@stellarjs/transport-redis'
import { stellarAppPubSub, stellarHandler } from '@stellarjs/core'

configureStellar({ log: console });
const handler = stellarHandler(transportFactory);
const publish = stellarAppPubSub(transportFactory);

const PUBLISH_ACTIONS = {
    CREATED: 'CREATED',
    UPDATED: 'UPDATED',
    REMOVED: 'REMOVED',
};

function kongEverySecond() {
    publish('stellarBridge:kong:stream', { text: `kong` }, { action: PUBLISH_ACTIONS.UPDATED });
    setTimeout(kongEverySecond, 10000);
}

handler.get('stellarBridge:ping', () => ({ text: `pong` }));

handler.handleRequest('stellarBridge:king:subscribe', () => ({ text: `kong` }));

setTimeout(kongEverySecond, 2000);
