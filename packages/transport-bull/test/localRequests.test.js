import {
  testRequestResponse,
  testMiddlewares,
  testRequestErrorResponse,
  testPubSubWith1Subscriber,
  doBeforeAll,
  doAfterAll
} from '../../../specs/localRequests.test';

import { onClose, factory } from './helpers';

describe('full integration req/response', () => {
  beforeAll(() => {
    doBeforeAll(factory);
  });

  afterAll(async () => doAfterAll(onClose));

  it('test local request response', testRequestResponse);
  it('test local request response with middlewares', testMiddlewares);
  it('test local request response stellar error', testRequestErrorResponse);
  it('test pubsub still works remotely', testPubSubWith1Subscriber);
});

