import _ from 'lodash';

import decorate from '../src/localRequestHandlersDecorator';
import Transport from '../src/Transport';

describe('local requestHandlers transport decorator', () => {
  let transport;
  const mockRequest = { headers: { queueName: 'remoteUrl' }, body: 'blah' };
  const mockTimeout = 2000;

  beforeEach(() => {
    jest.resetAllMocks();
    class MockTransport extends Transport {};

    MockTransport.prototype.request = jest.fn();
    MockTransport.prototype.fireAndForget = jest.fn();
    MockTransport.prototype.anythingElse = 'FOOBAR';
    MockTransport.prototype.subscribe = jest.fn();

    const TransportClazz = decorate(MockTransport);
    transport = new TransportClazz();

    transport.registries = {
      requestHandlers: {
        localUrl1: jest.fn(),
        localUrl2: jest.fn(),
      }
    };
  });


  describe('request', () => {
    it('should call remote when not locally', () => {
      transport.request(mockRequest, mockTimeout);
      expect(transport.registries.requestHandlers.localUrl1).not.toHaveBeenCalled();
      expect(transport.registries.requestHandlers.localUrl2).not.toHaveBeenCalled();
      expect(transport._request).toHaveBeenCalled();
      expect(transport._request.mock.calls).toHaveLength(1);
      expect(transport._request.mock.calls[0]).toEqual([mockRequest, mockTimeout]);
    });

    it('should call locally if possible', () => {
      const localMockRequest = _.defaultsDeep({headers: { queueName: 'localUrl2' }}, mockRequest);

      transport.request(localMockRequest, mockTimeout);
      expect(transport.registries.requestHandlers.localUrl1).not.toHaveBeenCalled();
      expect(transport.registries.requestHandlers.localUrl2).toHaveBeenCalled();
      expect(transport.registries.requestHandlers.localUrl2.mock.calls).toHaveLength(1);
      expect(transport.registries.requestHandlers.localUrl2.mock.calls[0]).toEqual([localMockRequest]);
      expect(transport._request).not.toHaveBeenCalled();
    });
  });

  describe('fireAndForget', () => {
    it('should call remote when not locally', () => {
      transport.fireAndForget(mockRequest, mockTimeout);
      expect(transport.registries.requestHandlers.localUrl1).not.toHaveBeenCalled();
      expect(transport.registries.requestHandlers.localUrl2).not.toHaveBeenCalled();
      expect(transport._fireAndForget).toHaveBeenCalled();
      expect(transport._fireAndForget.mock.calls).toHaveLength(1);
      expect(transport._fireAndForget.mock.calls[0]).toEqual([mockRequest]);
    });

    it('should call locally if possible', () => {
      const localMockRequest = _.defaultsDeep({headers: { queueName: 'localUrl2' }}, mockRequest);

      transport.fireAndForget(localMockRequest, mockTimeout);
      expect(transport.registries.requestHandlers.localUrl1).not.toHaveBeenCalled();
      expect(transport.registries.requestHandlers.localUrl2).toHaveBeenCalled();
      expect(transport.registries.requestHandlers.localUrl2.mock.calls).toHaveLength(1);
      expect(transport.registries.requestHandlers.localUrl2.mock.calls[0]).toEqual([localMockRequest]);
      expect(transport._fireAndForget).not.toHaveBeenCalled();
    });
  });
});