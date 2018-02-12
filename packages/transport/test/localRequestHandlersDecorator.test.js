import _ from 'lodash';

import decorate from '../src/localRequestHandlersDecorator';

describe('local requestHandlers messageAdatper decorator', () => {
  let messageAdapter;
  const mockRequest = { headers: { queueName: 'remoteUrl' }, body: 'blah' };
  const mockTimeout = 2000;

  beforeEach(() => {
    jest.resetAllMocks();
    messageAdapter = {
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
    it('should be the same messageAdapter except for request and fireAndForget', () => {
      const result = decorate(messageAdapter);

      expect(result.request).not.toEqual(messageAdapter.request);
      expect(result.fireAndForget).not.toEqual(messageAdapter.fireAndForget);
      expect(result.subscribe).toEqual(messageAdapter.subscribe);
      expect(result.anythingElse).toEqual('FOOBAR');
    });
  });

  describe('request', () => {
    it('should call remote when not locally', () => {
      const dma = decorate(messageAdapter);

      dma.request(mockRequest, mockTimeout);
      expect(dma.registries.requestHandlers.localUrl1).not.toHaveBeenCalled();
      expect(dma.registries.requestHandlers.localUrl2).not.toHaveBeenCalled();
      expect(messageAdapter.request).toHaveBeenCalled();
      expect(messageAdapter.request.mock.calls).toHaveLength(1);
      expect(messageAdapter.request.mock.calls[0]).toEqual([mockRequest, mockTimeout]);
    });

    it('should call locally if possible', () => {
      const dma = decorate(messageAdapter);
      const localMockRequest = _.defaultsDeep({headers: { queueName: 'localUrl2' }}, mockRequest);

      dma.request(localMockRequest, mockTimeout);
      expect(dma.registries.requestHandlers.localUrl1).not.toHaveBeenCalled();
      expect(dma.registries.requestHandlers.localUrl2).toHaveBeenCalled();
      expect(messageAdapter.registries.requestHandlers.localUrl2.mock.calls).toHaveLength(1);
      expect(messageAdapter.registries.requestHandlers.localUrl2.mock.calls[0]).toEqual([localMockRequest]);
      expect(messageAdapter.request).not.toHaveBeenCalled();
    });
  });

  describe('fireAndForget', () => {
    it('should call remote when not locally', () => {
      const dma = decorate(messageAdapter);

      dma.fireAndForget(mockRequest, mockTimeout);
      expect(dma.registries.requestHandlers.localUrl1).not.toHaveBeenCalled();
      expect(dma.registries.requestHandlers.localUrl2).not.toHaveBeenCalled();
      expect(messageAdapter.fireAndForget).toHaveBeenCalled();
      expect(messageAdapter.fireAndForget.mock.calls).toHaveLength(1);
      expect(messageAdapter.fireAndForget.mock.calls[0]).toEqual([mockRequest]);
    });

    it('should call locally if possible', () => {
      const dma = decorate(messageAdapter);
      const localMockRequest = _.defaultsDeep({headers: { queueName: 'localUrl2' }}, mockRequest);

      dma.fireAndForget(localMockRequest, mockTimeout);
      expect(dma.registries.requestHandlers.localUrl1).not.toHaveBeenCalled();
      expect(dma.registries.requestHandlers.localUrl2).toHaveBeenCalled();
      expect(messageAdapter.registries.requestHandlers.localUrl2.mock.calls).toHaveLength(1);
      expect(messageAdapter.registries.requestHandlers.localUrl2.mock.calls[0]).toEqual([localMockRequest]);
      expect(messageAdapter.fireAndForget).not.toHaveBeenCalled();
    });
  });
});