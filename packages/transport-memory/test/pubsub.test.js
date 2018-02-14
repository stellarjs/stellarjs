import {
  doBeforeAll,
  doAfterAll,
  testChannelMultiplexing,
  testPubSubWith1Subscriber,
  testPubSubWith3Subscribers,
  testResubscribe,
  testUnsubscribe
} from '../../../specs/pubsub.test';

import { transportGenerator, closeTransport } from './helpers';

describe('MEMORY full integration pub/sub per inbox', () => {
  beforeAll(() => {
    doBeforeAll(transportGenerator);
  });

  afterAll(() => {
    doAfterAll(closeTransport);
  });
  
  it('test pub sub 1 subscriber', testPubSubWith1Subscriber);
  it('test unsubscribe', testUnsubscribe);
  it('test resubscribe', testResubscribe);
  it('test pub sub 3 subscribers', testPubSubWith3Subscribers);
  it('test channel multiplexing', testChannelMultiplexing);
});
