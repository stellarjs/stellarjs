import _ from 'lodash';

import {
  doAfterAll, doBeforeAll,
  testPubSubWith1Subscriber,
  testPubSubWith3Subscribers,
  testPubSubWithOneRepeatSubscribersOnSameTransport,
  testPubSubWithOneRepeatSubscribersOnDifferentTransport
} from '../../../specs/grouppubsub.test';

import { factory } from './helpers';
import { MemoryTransport } from '../src';

xdescribe('MEMORY full integration pub/sub app', () => {
  beforeAll(() => {
    doBeforeAll(factory);
  });

  afterAll(() => {
    doAfterAll(_.noop);
  });

  it('test pub sub 1 subscriber', testPubSubWith1Subscriber);
  it('test pub sub 3 subscriber', testPubSubWith3Subscribers);
  it('test pub sub one repeat subscribers, same transport', testPubSubWithOneRepeatSubscribersOnSameTransport);
  it('test pub sub one repeat subscribers, different transport', testPubSubWithOneRepeatSubscribersOnDifferentTransport(({ source, log }) => new MemoryTransport(source, log, false)));
});
