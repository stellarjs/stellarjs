import axios from 'axios';

import clientFactory from '../src';

describe('axios client', () => {
    it('should use the axios passed on to client factory', async () => {
        const { stellar } = clientFactory({ baseURL: 'http://not.real', token: 'xxxx' }, console)
        const expectedBody = { hello: 'world' };

        await stellar.get('a:b:c', expectedBody);
        expect(axios.post).toHaveBeenCalledWith('/a/b/c/get',
            {
                headers: expect.any(Object),
                body: expectedBody,
            },
            expect.any(Object));
    });
});
