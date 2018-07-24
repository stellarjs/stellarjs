import Promise from 'bluebird';
import reduxStellar from '../src';
import { mockAction, mockRef, mockStellarSocket } from './mocks';

describe('client-redux', () => {
  const mockNext = jest.fn();

  const middleware = reduxStellar(mockStellarSocket());

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should pass the intercepted action to next', () => {
    const mock = mockStellarSocket({ a: 1 });
    const middleware = reduxStellar(mock);

    expect(middleware).toBeDefined();
    const action = mockAction({ });
    middleware(mockRef)(mockNext)(action);

    expect(mockNext.mock.calls[0][0].payload.promise).resolves.toHaveProperty('a', 1);
  });

  it('should pass the decorated response to next', () => {
    const mock = mockStellarSocket({ a: 1 });
    const middleware = reduxStellar(mock);

    class Decorator {
      constructor({ a }) {
        this.a = a;
      }
    }

    expect(middleware).toBeDefined();
    const action = mockAction({ Decorator });
    middleware(mockRef)(mockNext)(action);

    expect(mockNext.mock.calls[0][0].payload.promise).resolves.toBeInstanceOf(Decorator);
    expect(mockNext.mock.calls[0][0].payload.promise).resolves.toHaveProperty('a', 1);
  });

  it('should pass the intercepted action to next while unsubscribe while !method && !resource', () => {
    expect(middleware).toBeDefined();
    const action = mockAction({ resource: null, method: null });
    middleware(mockRef)(mockNext)(action);

    expect(mockNext)
          .toHaveBeenLastCalledWith(action);
  });

  it('should pass the intercepted action to next while unsubscribe', () => {
    expect(middleware).toBeDefined();
    const action = mockAction({ method: 'unsubscribe' });
    middleware(mockRef)(mockNext)(action);

    expect(mockNext)
          .toHaveBeenLastCalledWith({ type: action.type, payload: action.payload });
  });

  it('should pass the intercepted action to next while subscribe', () => {
    expect(middleware).toBeDefined();
    const action = mockAction({ method: 'subscribe', payload: () => {} });

    middleware(mockRef)(mockNext)(action);
    expect(mockNext)
          .toHaveBeenLastCalledWith({ type: action.type, payload: { promise: expect.any(Promise), data: action.payload } });
  });
});
