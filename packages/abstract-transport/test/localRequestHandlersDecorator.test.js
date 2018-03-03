import _ from 'lodash';

import decorate from '../src/localRequestHandlersDecorator';

describe('local requestHandlers transport decorator', () => {
  let transport;
  const mockRequest = { headers: { queueName: 'remoteUrl' }, body: 'blah' };
  const mockTimeout = 2000;

  beforeEach(() => {
    jest.resetAllMocks();
    transport = {
      request: jest.fn(),
      fireAndForget: jest.fn(),
      anythingElse: 'FOOBAR',
      subscribe: jest.fn(),
      registries: {
        requestHandlers: {
          localUrl1: jest.fn(),
          localUrl2: jest.fn(),
        }
      }
    }
  });

  describe('decorated object', () => {
    it('should be the same transport except for request and fireAndForget', () => {
      const result = decorate(transport);

      expect(result.request).not.toEqual(transport.request);
      expect(result.fireAndForget).not.toEqual(transport.fireAndForget);
      expect(result.subscribe).toEqual(transport.subscribe);
      expect(result.anythingElse).toEqual('FOOBAR');
    });
  });

  describe('request', () => {
    it('should call remote when not locally', () => {
      const dma = decorate(transport);

      dma.request(mockRequest, mockTimeout);
      expect(dma.registries.requestHandlers.localUrl1).not.toHaveBeenCalled();
      expect(dma.registries.requestHandlers.localUrl2).not.toHaveBeenCalled();
      expect(transport.request).toHaveBeenCalled();
      expect(transport.request.mock.calls).toHaveLength(1);
      expect(transport.request.mock.calls[0]).toEqual([mockRequest, mockTimeout]);
    });

    it('should call locally if possible', () => {
      const dma = decorate(transport);
      const localMockRequest = _.defaultsDeep({headers: { queueName: 'localUrl2' }}, mockRequest);

      dma.request(localMockRequest, mockTimeout);
      expect(dma.registries.requestHandlers.localUrl1).not.toHaveBeenCalled();
      expect(dma.registries.requestHandlers.localUrl2).toHaveBeenCalled();
      expect(transport.registries.requestHandlers.localUrl2.mock.calls).toHaveLength(1);
      expect(transport.registries.requestHandlers.localUrl2.mock.calls[0]).toEqual([localMockRequest]);
      expect(transport.request).not.toHaveBeenCalled();
    });
  });

  describe('fireAndForget', () => {
    it('should call remote when not locally', () => {
      const dma = decorate(transport);

      dma.fireAndForget(mockRequest, mockTimeout);
      expect(dma.registries.requestHandlers.localUrl1).not.toHaveBeenCalled();
      expect(dma.registries.requestHandlers.localUrl2).not.toHaveBeenCalled();
      expect(transport.fireAndForget).toHaveBeenCalled();
      expect(transport.fireAndForget.mock.calls).toHaveLength(1);
      expect(transport.fireAndForget.mock.calls[0]).toEqual([mockRequest]);
    });

    it('should call locally if possible', () => {
      const dma = decorate(transport);
      const localMockRequest = _.defaultsDeep({headers: { queueName: 'localUrl2' }}, mockRequest);

      dma.fireAndForget(localMockRequest, mockTimeout);
      expect(dma.registries.requestHandlers.localUrl1).not.toHaveBeenCalled();
      expect(dma.registries.requestHandlers.localUrl2).toHaveBeenCalled();
      expect(transport.registries.requestHandlers.localUrl2.mock.calls).toHaveLength(1);
      expect(transport.registries.requestHandlers.localUrl2.mock.calls[0]).toEqual([localMockRequest]);
      expect(transport.fireAndForget).not.toHaveBeenCalled();
    });
  });
});