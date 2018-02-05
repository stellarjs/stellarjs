import {
  doAfterAll, doBeforeAll, testMiddlewares, testRawRequestResponse, testRequestErrorResponse, testRequestResponse,
  testRequestResponseOverTwoQueues,
} from '../../../specs/requests.test';

import { messagingGenerator, closeMessaging } from './helpers';

describe('SOCKET full integration req/response', () => {
  beforeAll(() => {
    doBeforeAll(messagingGenerator);
  });

  afterAll(() => {
    doAfterAll(closeMessaging);
  });

  it('test request response', testRequestResponse);
  it('test request and raw response', testRawRequestResponse);
  it('test request response across two queues', testRequestResponseOverTwoQueues);
  it('test request response with middlewares', testMiddlewares);
  it('test request response stellar error', testRequestErrorResponse);
});
