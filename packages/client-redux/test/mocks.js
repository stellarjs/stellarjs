const mockStellarSocket = (response) => ({
  stellar: {
    getReactive(url, finalChannel, payload, handler, options) {
      return {
          onStop() {
              // return {
              //     stopper() {}
              // };
          },
          results() {},
      };
    },

    request(url, method, payload, options) {
      return Promise.resolve(response) || {
        url,
        method,
        payload,
        options,
      };
    },
  },
});

const mockRef = {
  dispatch() {},
  getState() {},
};

const mockAction = ({ resource = 'mockRecource', method = {}, payload = {}, path = '', Decorator }) => ({
  type: 'mockType',
  resource,
  path,
  method,
  payload,
  Decorator,
});

export { mockStellarSocket, mockRef, mockAction };
