import factory from '../src/factory';

describe('factory', () => {
    const log = console;
    const axios = 'fake';

    it('should pass all arguments to AxiosTransport instance', () => {
        const transport = factory({
            axios,
            source: 'fake source',
            log,
            requestTimeout: 1000,
        });
        expect(transport.constructor.name).toEqual('AxiosTransport');
        expect(transport.defaultRequestTimeout).toEqual(1000);
        expect(transport.axios).toEqual('fake');
    });
});