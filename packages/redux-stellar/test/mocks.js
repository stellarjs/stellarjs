import http from 'http';

const mockStellarSocket = {
    stellar: {
        getReactive(url, finalChannel, payload, handler, options) {
            const response = {
                onStop() {
                    // return {
                    //     stopper() {}
                    // };
                },
                results() {},
            };

            return response;
        },

        request(url, method, payload, options) {
            return {
                url,
                method,
                payload,
                options,
            }
        }
    },
};

const mockRef = {
    dispatch() {},
    getState() {},
};

const mockAction = ({ resource = 'mockRecource', method = {}, payload = {}, path = '' }) => ({
    type: 'mockType',
    resource,
    path,
    method,
    payload,
});

export { mockStellarSocket, mockRef, mockAction};
