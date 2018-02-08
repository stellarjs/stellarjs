import {
  doAfterAll, doBeforeAll,
  testPubSubWith1Subscriber,
  testPubSubWith3Subscribers,
  testPubSubWithOneRepeatSubscribersOnSameTransport,
  testPubSubWithOneRepeatSubscribersOnDifferentTransport
} from '../../../specs/grouppubsub.test';

import { messagingGenerator, closeMessaging } from './helpers';

describe('MEMORY full integration pub/sub app', () => {
  beforeAll(() => {
    doBeforeAll(messagingGenerator);
  });

  afterAll(() => {
    doAfterAll(closeMessaging);
  });

  it('test pub sub 1 subscriber', testPubSubWith1Subscriber);
  it('test pub sub 3 subscriber', testPubSubWith3Subscribers);
  it('test pub sub one repeat subscribers, same transport', testPubSubWithOneRepeatSubscribersOnSameTransport);
  it('test pub sub one repeat subscribers, different transport', testPubSubWithOneRepeatSubscribersOnDifferentTransport(messagingGenerator));
});
