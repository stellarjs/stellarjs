import _ from 'lodash';
import Promise from 'bluebird';

import { StellarError } from '../src/StellarError';
import { messagingMockFactory } from './mocks';
import StellarHandler from '../src/StellarHandler';

const getStellarHandler = () => {
  return new StellarHandler(messagingMockFactory(), 'test', console);
};

describe('StellarHandler', () => {
  let stellarHandler;

  beforeEach(() => {
    stellarHandler = getStellarHandler('testservice:resource:create');
  });

  describe('handleRequest calls', () => {
    beforeEach(() => {
      stellarHandler.handleRequest = jest.fn();
    });

    it('handleMethod should add method to url', () => {
      stellarHandler.handleMethod('testservice:resource', 'toot', _.noop);
      expect(stellarHandler.handleRequest).toHaveBeenCalled();
      expect(stellarHandler.handleRequest.mock.calls).toHaveLength(1);
      expect(stellarHandler.handleRequest.mock.calls[0]).toEqual(['testservice:resource:toot', _.noop]);
    });


    it('get should create a get url', () => {
      stellarHandler.get('testservice:resource', _.noop);
      expect(stellarHandler.handleRequest).toHaveBeenCalled();
      expect(stellarHandler.handleRequest.mock.calls).toHaveLength(1);
      expect(stellarHandler.handleRequest.mock.calls[0]).toEqual(['testservice:resource:get', _.noop]);
    });

    it('create should create an appropriate url', () => {
      stellarHandler.create('testservice:resource', _.noop);
      expect(stellarHandler.handleRequest).toHaveBeenCalled();
      expect(stellarHandler.handleRequest.mock.calls).toHaveLength(1);
      expect(stellarHandler.handleRequest.mock.calls[0]).toEqual(['testservice:resource:create', _.noop]);
    });

    it('remove should create a remove url', () => {
      stellarHandler.remove('testservice:resource', _.noop);
      expect(stellarHandler.handleRequest).toHaveBeenCalled();
      expect(stellarHandler.handleRequest.mock.calls).toHaveLength(1);
      expect(stellarHandler.handleRequest.mock.calls[0]).toEqual(['testservice:resource:remove', _.noop]);
    });

    it('update should create a get url', () => {
      stellarHandler.update('testservice:resource', _.noop);
      expect(stellarHandler.handleRequest).toHaveBeenCalled();
      expect(stellarHandler.handleRequest.mock.calls).toHaveLength(1);
      expect(stellarHandler.handleRequest.mock.calls[0]).toEqual(['testservice:resource:update', _.noop]);
    });
  });

  describe('mock handler', () => {
    let headers;

    beforeEach(() => {
      headers = {
        id: stellarHandler.messagingAdaptor.generateId(),
        traceId: '1',
        queueName: 'testservice:resource:create',
        source: 'test',
        timestamp: expect.any(Number),
        type: 'request',
      };
    });

    it('if a result is returned and a respondTo is set, send a response with the result', async () => {
      const req = { headers, body: { text: 'hello' } };
      const expectedStellarResponse = {
        headers: {
          id: '2',
          requestId: '1',
          source: 'test',
          timestamp: expect.any(Number),
          traceId: '1',
          type: 'response'
        },
        body: { text: 'world' }
      };

      const mockFn = jest.fn();
      mockFn.mockReturnValue({ text: 'world' });
      stellarHandler.handleRequest('url', mockFn);

      expect(stellarHandler.messagingAdaptor.addRequestHandler).toHaveBeenCalled();
      expect(stellarHandler.messagingAdaptor.addRequestHandler.mock.calls).toHaveLength(1);
      expect(stellarHandler.messagingAdaptor.addRequestHandler.mock.calls[0]).toEqual(['url', expect.any(Function)]);

      const res = await stellarHandler.messagingAdaptor.addRequestHandler.mock.calls[0][1](req);
      expect(res).toEqual(expectedStellarResponse);

      expect(mockFn.mock.calls).toHaveLength(1);
      expect(mockFn.mock.calls[0]).toEqual([req]);
    });

    it('use handler mw', async () => {
      const req = { headers, body: { text: 'hello' } };
      const expectedResult = {
        headers: { id: '2', requestId: '1', source: 'test', timestamp: expect.any(Number), traceId: '1', type: 'response' },
        body: { text: 'world' }
      };

      let mwResult;
      const mw = jest.fn();
      mw.mockImplementation((jobData, next, options, log) => {
        return next().then((result) => {
          mwResult = result;
          return result;
        });
      });
      stellarHandler.use('.*', mw);

      const mockFn = jest.fn();
      mockFn.mockReturnValue({ text: 'world' });
      stellarHandler.handleRequest('url', mockFn);

      const result = await stellarHandler.messagingAdaptor.addRequestHandler.mock.calls[0][1](req);

      expect(result).toEqual(expectedResult);

      expect(mockFn.mock.calls).toHaveLength(1);
      expect(mockFn.mock.calls[0]).toEqual([req]);

      expect(mw.mock.calls).toHaveLength(1);
      expect(mw.mock.calls[0]).toEqual([req, expect.any(Function), {}, console]);
      
      await Promise.delay(50);
      expect(mwResult).toEqual(expectedResult);
    });

    it('reject error from handler mw ', async () => {
      const req = { headers, body: { text: 'hello' } };
      const expectedResult = new StellarError('boo hoo');
      const expectedStellarResponse = {
        headers: {
          id: '2',
          requestId: '1',
          source: 'test',
          errorSource: 'test',
          errorType: 'StellarError',
          timestamp: expect.any(Number),
          traceId: '1',
          type: 'response'
        },
        body: { errors: { general: ['boo hoo'] }, message: 'boo hoo' }
      };

      const mw = jest.fn();
      mw.mockImplementation(() => Promise.reject(new StellarError('boo hoo')));
      stellarHandler.use('.*', mw);

      const mockFn = jest.fn();
      mockFn.mockReturnValue({ text: 'world' });
      stellarHandler.handleRequest('url', mockFn);

      try {
        const result = await stellarHandler.messagingAdaptor.addRequestHandler.mock.calls[0][1](req);
        fail('should throw');
      } catch (err) {
        expect(err).toEqual(expectedResult);
        expect(err.__stellarResponse).toEqual(expectedStellarResponse);
      }
      
      expect(mockFn.mock.calls).toHaveLength(0);

      expect(mw.mock.calls).toHaveLength(1);
      expect(mw.mock.calls[0]).toEqual([req, expect.any(Function), {}, console]);
    });

    it('throw error from handler mw ', async () => {
      const req = { headers, body: { text: 'hello' } };
      const expectedResult = new StellarError('boo hoo');
      const expectedStellarResponse = {
        headers: {
          id: '2',
          requestId: '1',
          source: 'test',
          errorSource: 'test',
          errorType: 'StellarError',
          timestamp: expect.any(Number),
          traceId: '1',
          type: 'response'
        },
        body: { errors: { general: ['boo hoo'] }, message: 'boo hoo' }
      };
      
      const mw = jest.fn();
      mw.mockImplementation(() => {
        throw new StellarError('boo hoo');
      });
      stellarHandler.use('.*', mw);

      const mockFn = jest.fn();
      mockFn.mockReturnValue({ text: 'world' });
      stellarHandler.handleRequest('url', mockFn);

      try {
        const result = await stellarHandler.messagingAdaptor.addRequestHandler.mock.calls[0][1](req);
        fail('should throw');
      } catch (err) {
        expect(err).toEqual(expectedResult);
        expect(err.__stellarResponse).toEqual(expectedStellarResponse);
      }

      expect(mockFn.mock.calls).toHaveLength(0);

      expect(mw.mock.calls).toHaveLength(1);
      expect(mw.mock.calls[0]).toEqual([req, expect.any(Function), {}, console]);
    });

    it('use handler mw in stellar error state', async () => {
      const req = { headers, body: { text: 'hello' } };
      const error = new Error('boo hoo');
      const expectedStellarResponse = {
        headers: {
          id: '2',
          requestId: '1',
          source: 'test',
          errorSource: 'test',
          errorType: 'Error',
          timestamp: expect.any(Number),
          traceId: '1',
          type: 'response'
        },
        body: { message: 'boo hoo' }
      };

      let mwError;

      const mw = jest.fn();
      mw.mockImplementation((jobData, next) => {
        return next().catch((error) => {
          mwError = error;
          return Promise.reject(error);
        });
      });
      stellarHandler.use('.*', mw);

      const mockFn = jest.fn();
      mockFn.mockReturnValue(Promise.reject(error));
      stellarHandler.handleRequest('url', mockFn);

      try {
        await stellarHandler.messagingAdaptor.addRequestHandler.mock.calls[0][1](req);
        fail('expected a throw');
      } catch (err) {
        expect(err).toEqual(error);
        expect(err.__stellarResponse).toEqual(expectedStellarResponse);
      }

      expect(mockFn.mock.calls).toHaveLength(1);
      expect(mockFn.mock.calls[0]).toEqual([req]);

      expect(mwError).toEqual(error);
      expect(mwError.__stellarResponse).toEqual(expectedStellarResponse);
    });
  });
});
