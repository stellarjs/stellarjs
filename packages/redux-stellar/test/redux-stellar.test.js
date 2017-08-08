import reduxStellar from '../src';
import { mockAction, mockRef, mockStellarSocket} from './mocks';

describe('redux-stellar', () => {
    const mockNext = jest.fn();

    const middleware = reduxStellar(mockStellarSocket);

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should pass the intercepted action to next', () => {
        expect(middleware).toBeDefined();
        const action = mockAction({});
        middleware(mockRef)(mockNext)(action);

        const expectedPayload = {
            url: action.resource,
            method: action.method,
            payload: action.payload,
            options: action.options,
        };

        expect(mockNext)
          .toHaveBeenLastCalledWith( { type: action.type, payload: expectedPayload });
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
          .toHaveBeenLastCalledWith( { type: action.type, payload: action.payload });
    });

    it('should pass the intercepted action to next while subscribe', () => {
        expect(middleware).toBeDefined();
        const action = mockAction({ method: 'subscribe', payload: () => {} });

        middleware(mockRef)(mockNext)(action);
        expect(mockNext)
          .toHaveBeenLastCalledWith( { type: action.type, payload: Promise.prototype });
    });
});