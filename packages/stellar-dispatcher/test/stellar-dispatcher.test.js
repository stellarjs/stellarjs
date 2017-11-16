import { configure, dispatch } from '../src';
import { mockAction, mockRef, mockStellarSocket} from './mocks';

describe('stellar-dispatcher', () => {
    const simpleAction = {
        resource: 'resource',
        path: 'path',
        method: 'method',
        channel: 'channel',
        payload: { x: 'x' },
        options: {
            headers: {
                operationId: 'ID',
            },
        },
    };

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should send a simple request matching the properties of the action', (done) => {
        configure({
            request: {
                request: function (path, method, payload, options) {
                    expect(path).toEqual(`${simpleAction.resource}:${simpleAction.path}`);
                    expect(method).toEqual(simpleAction.method);
                    expect(payload).toEqual(simpleAction.payload);
                    expect(options).toEqual(simpleAction.options);
                    done();
                }
            }
        });
        dispatch(simpleAction);
    });

    it('should send an unsubscribe request matching the properties of the action', (done) => {
        configure({
            request: {
                request: function (path, method, payload, options) {
                    expect(path).toEqual(`${simpleAction.resource}:${simpleAction.path}`);
                    expect(method).toEqual(simpleAction.method);
                    expect(payload).toEqual(simpleAction.payload);
                    expect(options).toEqual(simpleAction.options);
                    done();
                }
            }
        });
        dispatch(simpleAction);
    });
});