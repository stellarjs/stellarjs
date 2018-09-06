import factory from '../src/factory';

describe('factory', () => {
    const log = console;
    const axios = {
      post: jest.fn()
    };

    it('should pass all arguments to AxiosTransport instance', () => {
        const transport = factory({
            axios,
            source: 'fake source',
            log,
            requestTimeout: 1000,
        });
        expect(transport.constructor.name).toEqual('AxiosTransport');
        expect(transport.defaultRequestTimeout).toEqual(1000);
        expect(transport.axios).toBe(axios);
    });
});