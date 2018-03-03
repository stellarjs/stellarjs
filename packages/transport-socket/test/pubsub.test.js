import {
  doBeforeAll,
  doAfterAll,
  testChannelMultiplexing,
  testPubSubWith1Subscriber,
  testPubSubWith3Subscribers,
  testResubscribe,
  testUnsubscribe
} from '../../../specs/pubsub.test';

import { factory, onClose } from './helpers';

describe('SOCKET full integration pub/sub per inbox', () => {
  beforeAll(() => {
    doBeforeAll(factory);
  });

  afterAll(() => {
    doAfterAll(onClose);
  });
  
  it('test pub sub 1 subscriber', testPubSubWith1Subscriber);
  it('test unsubscribe', testUnsubscribe);
  it('test resubscribe', testResubscribe);
  it('test pub sub 3 subscribers', testPubSubWith3Subscribers);
  it('test channel multiplexing', testChannelMultiplexing);
});
