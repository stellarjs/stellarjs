import forOwn from 'lodash/forOwn';
import forEach from 'lodash/forEach';
import isPlainObject from 'lodash/isPlainObject';
import isArray from 'lodash/isArray';
import head from 'lodash/head';

export default function stellarLoaderFactory(stellarHandler) {
  function _handleLoader(resource, method, value) {
    const url = `${resource}:${method}`;

    if (!value) {
      throw new Error(`stellarLoaderFactory: no function defined for ${resource}.${method}`);
    }

    if (isArray(value)) {
      const handler = head(value);
      const middlewares = value.slice(1);
      forEach(middlewares, m => stellarHandler.use(url, m));
      return stellarHandler.handleRequest(url, ({ headers, body }) => handler(headers, body));
    }

    return stellarHandler.handleRequest(url, ({ headers, body }) => value(headers, body));
  }

  return function load(resource, loaders) {
    forOwn(loaders, (value, method) => {
      if (method === 'middlewares') {
        forEach(value, m => this.use(resource, m));
        return;
      }

      if (isPlainObject(value)) {
        forOwn(value, (loader, action) => {
          const url = action === 'default' ? resource : `${resource}:${action}`;
          return _handleLoader(url, method, loader);
        });
        return;
      }

      _handleLoader(resource, method, value);
    });
  };
}
