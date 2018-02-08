import Promise from 'bluebird';
import _ from 'lodash';

import { StellarError } from '../src/StellarError';
import { default as StellarRequest } from '../src/StellarRequest';

import { expectMethodMocksToHaveBeeenCalled } from './helpers';
import { messagingMockFactory } from './mocks';

function getStellarRequest(){
  return new StellarRequest(messagingMockFactory(), 'test', console);
}

describe('StellarRequest', () => {
    const headers = {
        id: '1',
        traceId: '1',
        queueName: 'testservice:resource:create',
        source: 'test',
        timestamp: expect.any(Number),
        type: 'request',
    };

    describe('mock request response', () => {
        it('send request, expect response', async () => {
            const stellarRequest = getStellarRequest();
            stellarRequest.messagingAdaptor.request.mockReturnValue(Promise.resolve({ headers: {}, body: { text: 'world' }}));

            const result = await stellarRequest.create('testservice:resource', { text: 'hello' });

            expect(result.body).toEqual({ text: 'world' });
            expectMethodMocksToHaveBeeenCalled(
              stellarRequest.messagingAdaptor,
              { name: 'request', numCalls: 1, args: [[{ headers, body: { text: 'hello' } }]] },
              { name: 'generateId', numCalls: 2 });
        });

        it('Should catch timeouts and return an error', async () => {
            const stellarRequest = getStellarRequest();
            stellarRequest.messagingAdaptor.request.mockReturnValue(Promise.reject(new StellarError("Timeout")));

            try {
                await stellarRequest.create('testservice:resource', { text: 'hello' });
                fail('error');
            } catch (e) {
                expect(e).toBeInstanceOf(StellarError);
                expect(e.message).toEqual('Timeout');
                expectMethodMocksToHaveBeeenCalled(
                  stellarRequest.messagingAdaptor,
                  { name: 'request', numCalls: 1, args: [[{ headers, body: { text: 'hello' } }]] },
                  { name: 'generateId', numCalls: 2 });
            }
        });

        it('receive response array', async () => {
            const stellarRequest = getStellarRequest();
            stellarRequest.messagingAdaptor.request.mockReturnValue(Promise.resolve({ headers: {}, body: [{ text: 'bye' }, { text: 'world' }]}));

            const result = await stellarRequest.update('testservice:resource', [{ text: 'hello' }, { text: 'world' }]);

            expect(result.body).toEqual([{ text: 'bye' }, { text: 'world' }]);
            expectMethodMocksToHaveBeeenCalled(
              stellarRequest.messagingAdaptor,
              { name: 'request', numCalls: 1, args: [[{ headers: _.assign({}, headers, { queueName: 'testservice:resource:update' }), body: [{ text: 'hello' }, { text: 'world' }] }]] },
              { name: 'generateId', numCalls: 2 });

        });

        it('receive js error', async () => {
            const stellarRequest = getStellarRequest();
            stellarRequest.messagingAdaptor.request.mockReturnValue(Promise.resolve({ headers: { type: 'response', errorType: 'Error' }, body: { message: 'blah' } }));

            try {
                const result = await stellarRequest.create('testservice:resource', { text: 'hello' });
                fail('Exception should have been thrown');
            } catch(e) {
                expect(e).toBeInstanceOf(Error);
                expect(e.message).toEqual('blah');
                expectMethodMocksToHaveBeeenCalled(
                  stellarRequest.messagingAdaptor,
                  { name: 'request', numCalls: 1, args: [[{ headers, body: { text: 'hello' } }]] },
                  { name: 'generateId', numCalls: 2 });
            }
        });

        it('receive stellar error', async () => {
            const stellarRequest = getStellarRequest();
            stellarRequest.messagingAdaptor.request.mockReturnValue(Promise.resolve({ headers: { type: 'response', errorType: 'StellarError' }, body: { message: 'blah' } }));

            try {
                const result = await stellarRequest.create('testservice:resource', { text: 'hello' });
                fail('Exception should have been thrown');
            } catch(e) {
                expect(e).toBeInstanceOf(StellarError);
                expect(e.message).toEqual('blah');
                expectMethodMocksToHaveBeeenCalled(
                  stellarRequest.messagingAdaptor,
                  { name: 'request', numCalls: 1, args: [[{ headers, body: { text: 'hello' } }]] },
                  { name: 'generateId', numCalls: 2 });
            }
        });

        it('receive raw stellar error', async () => {
            const stellarRequest = getStellarRequest();
            stellarRequest.messagingAdaptor.request.mockReturnValue(Promise.resolve({ headers: { type: 'response', errorType: 'StellarError' }, body: { message: 'blah' } }));

            const result = await stellarRequest.create('testservice:resource', { text: 'hello' }, { responseType: 'raw' });
            expect(result).toEqual({ headers: _.assign({}, headers, {id: '2', requestId: '1', queueName: undefined, errorType: 'StellarError', type: 'response' }), body: { message: 'blah' } })
            expectMethodMocksToHaveBeeenCalled(
              stellarRequest.messagingAdaptor,
              { name: 'request', numCalls: 1, args: [[{ headers, body: { text: 'hello' } }]] },
              { name: 'generateId', numCalls: 2 });
        });
    });

    describe('fireAndForget', () => {
        it('send request, no response', async () => {
            const stellarRequest = getStellarRequest();

            await stellarRequest.remove('testservice:resource', 99, { requestOnly: true });

            expectMethodMocksToHaveBeeenCalled(
              stellarRequest.messagingAdaptor,
              { name: 'fireAndForget', numCalls: 1, args: [[{ headers: _.assign({}, headers, { queueName: 'testservice:resource:remove' }), body: 99 }]] },
              { name: 'generateId', numCalls: 2 });
        });
    });

    describe('stellarRequest middlewares', () => {
        it('use request mw', async () => {
            const stellarRequest = getStellarRequest();
            stellarRequest.messagingAdaptor.request.mockReturnValue(Promise.resolve({ headers: {}, body: { text: 'world' }}));

            const mw = jest.fn();
            mw.mockImplementation((jobData, next, options, log) => {
                _.assign(jobData.headers, { userId: 1 });
                return next();
            });
            stellarRequest.use('.*', mw);

            await stellarRequest.get('testservice:resource', { text: 'toot' });

            expect(mw).toHaveBeenCalled();
            expectMethodMocksToHaveBeeenCalled(
              stellarRequest.messagingAdaptor,
              { name: 'request',
                  numCalls: 1,
                  args: [[
                    {
                        headers: _.assign({}, headers, { userId: 1,queueName: 'testservice:resource:get' }),
                        body: { text: 'toot' }
                    }]] },
              { name: 'generateId', numCalls: 2 });
        });

        it('ignore unmatched mw', async () => {
            const stellarRequest = getStellarRequest();
            stellarRequest.messagingAdaptor.request.mockReturnValue(Promise.resolve({ headers: {}, body: { text: 'world' }}));

            const middlewareRun = {
                '.*:create': false,
                '.*:get': false,
                'testservice:resource:.*': false,
                'testservice:not:.*': false,
            };
            _.forEach(middlewareRun, (v, k) => {
                stellarRequest.use(k, (jobData, next) => {
                    middlewareRun[k] = true;
                    return next();
                });
            });

            await stellarRequest.get('testservice:resource', { text: 'toot' });

            expect(middlewareRun).toEqual({
                                              '.*:create': false,
                                              '.*:get': true,
                                              'testservice:resource:.*': true,
                                              'testservice:not:.*': false,
                                          });

            expectMethodMocksToHaveBeeenCalled(
              stellarRequest.messagingAdaptor,
              { name: 'request',
                  numCalls: 1,
                  args: [[
                      {
                          headers: _.assign({}, headers, { queueName: 'testservice:resource:get' }),
                          body: { text: 'toot' }
                      }]] },
              { name: 'generateId', numCalls: 2 });
        });
    });
});
