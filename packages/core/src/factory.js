/**
 * Created by arolave on 05/10/2016.
 */
/* eslint-disable */
import assign from 'lodash/assign';
import includes from 'lodash/includes';

import StellarHandler from './StellarHandler';
import StellarPubSub from './StellarPubSub';
import StellarRequest from './StellarRequest';

const requestTimeout = process.env.STELLAR_REQUEST_TIMEOUT || 30000;

function preconfigure({ defaultSourceGenerator, sourceGenerators }) {
    const _defaultSourceGenerator = defaultSourceGenerator;
    const _sourceGenerators = sourceGenerators;

    function getSourceGenerator(value) {
        return _sourceGenerators[ value || process.env.STELLAR_SOURCE_GENERATOR || _defaultSourceGenerator ];
    }
    
    const _registry = {};
    function register(source, name) {
        if (includes(_registry[source], name)) {
            throw new Error(`@Factory Unable to register multiple ${name} instances for ${source}`);
        }

        if (_registry[source]) {
            _registry[source].push(name);
        } else {
            _registry[source] = [name];
        }
    };

    return function configure({ log, transport, transportFactory, source, sourceGenerator, app = process.env.APP, ...options }) {
        const _app = app;
        const _log = log || console;
        const _transport = transport || transportFactory(assign({log}, options));
        const _source = source || getSourceGenerator(sourceGenerator)(_log);
        const _requestTimeout = options.requestTimeout || requestTimeout;
        _log.info(`setting source ${_source}`);

        function stellarAppPubSub(options = {}) {
            register(_source, 'stellarAppPubSub');
            return new StellarPubSub(_transport, _source, _log, _app);
        }

        function stellarNodePubSub(options = {}) {
            const source = options.sourceOverride || _source;
            register(source, 'stellarNodePubSub');
            return new StellarPubSub(_transport, source, _log);
        }

        function stellarRequest(options = {}) {
            const source = options.sourceOverride || _source;
            register(source, 'stellarRequest');
            return new StellarRequest(_transport, source, _log, _requestTimeout, stellarNodePubSub(options));
        }

        function stellarHandler() {
            register(_source, 'stellarHandler');
            return new StellarHandler(_transport, _source, _log, _app);
        }

        return {
          source: _source,
          stellarRequest,
          stellarHandler,
          stellarAppPubSub,
          stellarNodePubSub,
        };
    }
}

export {
  preconfigure
};
