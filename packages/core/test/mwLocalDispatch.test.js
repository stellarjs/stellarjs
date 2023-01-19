import mwLocalDispatchFactory from '../src/mwLocalDispatch';
import { Transport } from '@gf-stellarjs/abstract-transport';

describe('local dispatch middleware', () => {
  const transport = new Transport();
  transport.registries = {
    requestHandlers: {
      localUrl1: jest.fn(),
      localUrl2: jest.fn(),
    }
  };

  const next = jest.fn();

  function buildReq(url, type) {
    return { headers: { queueName: url, type }, body: 'blah' };
  }

  const mockNextReturnValue = 'mockNextReturnValue';
  const mockLocalReturnValue = 'mockLocalReturnValue';

  describe('request', () => {

    beforeEach(() => {
      jest.resetAllMocks();
      next.mockReturnValue(mockNextReturnValue);
      transport.registries.requestHandlers.localUrl1.mockReturnValue(Promise.resolve(mockLocalReturnValue));
      transport.registries.requestHandlers.localUrl2.mockReturnValue(mockLocalReturnValue);
    });

    const mwLocalDispatch = mwLocalDispatchFactory();

    it('should call remote when not locally', () => {
      const req = buildReq('remoteUrl', 'request');
      const retval = mwLocalDispatch(req, next, {}, console, transport);
      
      expect(next).toHaveBeenCalled();
      expect(transport.registries.requestHandlers.localUrl1).not.toHaveBeenCalled();
      expect(transport.registries.requestHandlers.localUrl2).not.toHaveBeenCalled();
      expect(retval).toEqual(mockNextReturnValue);
    });

    it('should call locally if possible', () => {
      const req = buildReq('localUrl2', 'request');
      const retval = mwLocalDispatch(req, next, {}, console, transport);

      expect(transport.registries.requestHandlers.localUrl1).not.toHaveBeenCalled();
      expect(transport.registries.requestHandlers.localUrl2).toHaveBeenCalled();
      expect(transport.registries.requestHandlers.localUrl2.mock.calls).toHaveLength(1);
      expect(transport.registries.requestHandlers.localUrl2.mock.calls[0]).toEqual([req]);
      expect(next).not.toHaveBeenCalled();
      expect(retval).toEqual(mockLocalReturnValue);
    });


    it('should call & handle promise locally if possible', async () => {
      const req = buildReq('localUrl1', 'request');
      const retvalPromise = mwLocalDispatch(req, next, {}, console, transport);

      expect(transport.registries.requestHandlers.localUrl1).toHaveBeenCalled();
      expect(transport.registries.requestHandlers.localUrl2).not.toHaveBeenCalled();
      expect(transport.registries.requestHandlers.localUrl1.mock.calls).toHaveLength(1);
      expect(transport.registries.requestHandlers.localUrl1.mock.calls[0]).toEqual([req]);
      expect(next).not.toHaveBeenCalled();
      expect(retvalPromise).toBeInstanceOf(Promise);
      expect(await retvalPromise).toEqual(mockLocalReturnValue);
    });
  });


  describe('fireAndForget', () => {
    const mwLocalDispatch = mwLocalDispatchFactory();

    beforeEach(() => {
      jest.resetAllMocks();
      next.mockReturnValue(undefined);
      transport.registries.requestHandlers.localUrl2.mockReturnValue(mockLocalReturnValue);
    });


    it('should call remote when not locally', () => {
      const req = buildReq('remoteUrl', 'fireAndForget');
      const retval = mwLocalDispatch(req, next, {}, console, transport);

      expect(next).toHaveBeenCalled();
      expect(transport.registries.requestHandlers.localUrl1).not.toHaveBeenCalled();
      expect(transport.registries.requestHandlers.localUrl2).not.toHaveBeenCalled();
      expect(retval).toEqual(undefined);
    });

    it('should call locally if possible', () => {
      const req = buildReq('localUrl2', 'fireAndForget');
      const retval = mwLocalDispatch(req, next, {}, console, transport);

      expect(transport.registries.requestHandlers.localUrl1).not.toHaveBeenCalled();
      expect(transport.registries.requestHandlers.localUrl2).toHaveBeenCalled();
      expect(transport.registries.requestHandlers.localUrl2.mock.calls).toHaveLength(1);
      expect(transport.registries.requestHandlers.localUrl2.mock.calls[0]).toEqual([req]);
      expect(next).not.toHaveBeenCalled();
      expect(retval).toEqual(undefined);
    });
  });

  describe('publish', () => {
    const mwLocalDispatch = mwLocalDispatchFactory();
    
    beforeEach(() => {
      jest.resetAllMocks();
      next.mockReturnValue(undefined);
      transport.registries.requestHandlers.localUrl2.mockReturnValue(mockLocalReturnValue);
    });

    const req = buildReq('localUrl1', 'publish');
    const retval = mwLocalDispatch(req, next, {}, console, transport);

    expect(transport.registries.requestHandlers.localUrl1).not.toHaveBeenCalled();
    expect(transport.registries.requestHandlers.localUrl2).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(retval).toEqual(undefined);
  });

});