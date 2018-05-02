import factory from '../src/factory';

describe('factory', () => {
    const log = console;
    const express = 'fake';

    beforeEach(() => {
    });

    it('should pass all arguments to AxiosTransport instance', () => {
        const transport = factory({
            express,
            source: 'fake source',
            log,
        });
        expect(transport.constructor.name).toEqual('ExpressTransport');
        expect(transport.express).toEqual('fake');
    });
});