import {
  doAfterAll, doBeforeAll,
  testPubSubWith1Subscriber,
  testPubSubWith3Subscribers,
  testPubSubWithOneRepeatSubscribersOnSameTransport,
  testPubSubWithOneRepeatSubscribersOnDifferentTransport
} from '../../../specs/grouppubsub.test';

import { closeTransport, transportGenerator } from './helpers';

describe('full integration pub/sub app', () => {
  beforeAll(() => {
    doBeforeAll(transportGenerator);
  });

  afterAll(() => {
    doAfterAll(closeTransport);
  });

  it('test pub sub 1 subscriber', testPubSubWith1Subscriber);
  it('test pub sub 3 subscriber', testPubSubWith3Subscribers);
  it('test pub sub one repeat subscribers, same transport', testPubSubWithOneRepeatSubscribersOnSameTransport);
  it('test pub sub one repeat subscribers, different transport', testPubSubWithOneRepeatSubscribersOnDifferentTransport(transportGenerator));
});
