import factory from '../src/factory';

describe('e2e', () => {
    const log = console;
    const express = 'fake';

    beforeEach(() => {
    });

    it('should pass all arguments to AxiosTransport instance', () => {
        const transport = factory({
            log,
            source: 'fake source',
            router: express,
        });
        expect(transport.constructor.name).toEqual('ExpressTransport');
        expect(transport.router).toEqual('fake');
    });
});