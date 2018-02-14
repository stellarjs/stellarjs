import {
  testRequestResponse,
  testRawRequestResponse,
  testRequestResponseOverTwoQueues,
  testMiddlewares,
  testRequestErrorResponse,
  testRequestTimeout,
  doBeforeAll,
  doAfterAll
} from '../../../specs/requests.test';

import { closeTransport, transportGenerator } from './helpers';

describe('full integration req/response', () => {
  beforeAll(() => {
    doBeforeAll(transportGenerator);
  });

  afterAll(() => {
    doAfterAll(closeTransport);
  });

  it('test request response', testRequestResponse);
  it('test request and raw response', testRawRequestResponse);
  it('test request response across two queues', testRequestResponseOverTwoQueues);
  it('test request response with middlewares', testMiddlewares);
  it('test request response stellar error', testRequestErrorResponse);
  it('test request timeout', testRequestTimeout);
});

// requestsSpec(transportGenerator, afterAll, true);
