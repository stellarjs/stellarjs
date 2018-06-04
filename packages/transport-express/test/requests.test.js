import {
  doAfterAll, doBeforeAll, testMiddlewares, testRawRequestResponse, testRequestErrorResponse, testRequestResponse,
  testRequestResponseOverTwoQueues,
} from '../../../specs/requests.test';

import { factory } from './helpers';

describe('HTTP full integration req/response', () => {
  beforeAll(() => {
    doBeforeAll(factory);
  });

  afterAll(() => {
    doAfterAll(() => {});
  });

  it('test request response', testRequestResponse);
  it('test request and raw response', testRawRequestResponse(true));
  it('test request response across two queues', testRequestResponseOverTwoQueues);
  it('test request response with middlewares', testMiddlewares);
  it('test request response stellar error', testRequestErrorResponse);
});
