import _ from 'lodash';
import Promise from 'bluebird';
import RemoteTransport from '../src/RemoteTransport';
import StellarError from '../../stellar-error/lib-es6';

describe('RemoteTransport', () => {
  let instance;

  beforeEach(() => {
    instance = new RemoteTransport('source', console);
    instance.remoteRequest = jest.fn();
    instance.remoteRequest.mockName('instance.remoteRequest');
  });

  describe('requestResponse', () => {
    it('Should call enqueue, await a response, and then resolve once the response is received', async () => {
      const serviceName = 'serviceName';
      const queueName = `${serviceName}:queueName`;
      const responseInbox = `stlr:n:source:res`;
      const req = { headers: { id: 1, queueName }, body: { message: 'hello' }};
      const res = { headers: { id: 2, requestId: 1, queueName: responseInbox }, body: { message: 'world' }};

      instance.remoteRequest.mockReturnValue(Promise.resolve(true));

      const response = instance.request(req, 100);
      await Promise.delay(50);

      expect(instance.inflightRequests).toEqual({ '1': [expect.any(Function), expect.any(Function), expect.any(Object)] });

      instance._responseHandler(res);

      await expect(response).resolves.toEqual(res);
      expect(instance.remoteRequest.mock.calls).toEqual([[req]]);
      expect(instance.inflightRequests).toEqual({});
    });

    it('Should call enqueue, await a response, and then timeout', async () => {
      const serviceName = 'serviceName';
      const queueName = `${serviceName}:queueName`;
      const req = { headers: { id: 1, queueName }, body: { message: 'hello' }};
      const timeoutError = new StellarError(`@RemoteTransport: TIMEOUT after 500ms. requestId=1`);

      instance.remoteRequest.mockReturnValue(Promise.resolve(true));

      const response = instance.request(req, 500);
      await Promise.delay(50);

      expect(instance.inflightRequests).toEqual({ '1': [expect.any(Function), expect.any(Function), expect.any(Object)] });

      await expect(response).rejects.toEqual(timeoutError);
      expect(instance.remoteRequest.mock.calls).toEqual([[req]]);
      expect(instance.inflightRequests).toEqual({});
    });

    it('Should call enqueue, await a response, and never timeout', async () => {
      const serviceName = 'serviceName';
      const queueName = `${serviceName}:queueName`;
      const req = { headers: { id: 1, queueName }, body: { message: 'hello' }};

      instance.remoteRequest.mockReturnValue(Promise.resolve(true));

      instance.request(req);
      await Promise.delay(50);

      expect(instance.remoteRequest.mock.calls).toEqual([[req]]);
      expect(instance.inflightRequests).toEqual({1: [expect.any(Function), expect.any(Function), undefined]});

      await Promise.delay(3000);

      expect(instance.inflightRequests).toEqual({1: [expect.any(Function), expect.any(Function), undefined]});
    });
  });

  describe('fireAndForget', () => {
    it('Should call enqueue but not await a response', async () => {
      const serviceName = 'serviceName';
      const queueName = `${serviceName}:queueName`;
      const req = { headers: { queueName }, body: { foo: 'bar' }};

      instance.remoteRequest.mockReturnValue(Promise.resolve(true));

      await expect(instance.fireAndForget(req)).resolves.toBe(true);

      expect(instance.inflightRequests).toEqual({});

      expect(instance.remoteRequest.mock.calls).toEqual([[req]]);
    });

    it('Multiple calls must not call process again', async () => {
      const serviceName = 'serviceName';
      const queueName = `${serviceName}:queueName`;
      const req = { headers: { queueName }, body: { foo: 'bar' }};

      instance.remoteRequest.mockReturnValue(Promise.resolve(true));

      await expect(instance.fireAndForget(req)).resolves.toBe(true);
      await expect(instance.fireAndForget(req)).resolves.toBe(true);
      await expect(instance.fireAndForget(req)).resolves.toBe(true);

      expect(instance.inflightRequests).toEqual({});


      expect(instance.remoteRequest.mock.calls).toEqual([[req],[req],[req]]);
    });
  });

  describe('reset', () => {
    it('should reset ok', async () => {
      instance.remoteRequest.mockReturnValue(Promise.resolve(true));

      instance.inflightRequests = { inflight: _.noop };

      await instance.reset();

      expect(instance.inflightRequests).toEqual({});
    });
  });
});