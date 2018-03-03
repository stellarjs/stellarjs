import {
  doAfterAll, doBeforeAll,
  testPubSubWith1Subscriber,
  testPubSubWith3Subscribers,
  testPubSubWithOneRepeatSubscribersOnSameTransport,
  testPubSubWithOneRepeatSubscribersOnDifferentTransport
} from '../../../specs/grouppubsub.test';

import { factory, onClose } from './helpers';

describe('SOCKET full integration pub/sub app', () => {
  beforeAll(() => {
    doBeforeAll(factory);
  });

  afterAll(() => {
    doAfterAll(onClose);
  });

  xit('test pub sub 1 subscriber', testPubSubWith1Subscriber);
  xit('test pub sub 3 subscriber', testPubSubWith3Subscribers);
  it('test pub sub one repeat subscribers, same transport', testPubSubWithOneRepeatSubscribersOnSameTransport);
  it('test pub sub one repeat subscribers, different transport', testPubSubWithOneRepeatSubscribersOnDifferentTransport(factory));
});
