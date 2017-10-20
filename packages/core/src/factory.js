/**
 * Created by arolave on 05/10/2016.
 */
import assign from 'lodash/assign';
import includes from 'lodash/includes';

import StellarHandler from './StellarHandler';
import StellarPubSub from './StellarPubSub';
import StellarRequest from './StellarRequest';

const requestTimeout = process.env.STELLAR_REQUEST_TIMEOUT || 30000;

let _log = console;
function configureStellarLog(stellarLog) {
  if (stellarLog) {
    _log = stellarLog; // eslint-disable-line better-mutation/no-mutation
  }
}

let _defaultSourceGenerator = null;
let _sourceGenerators = null;
let _source = null;
let _transport = null;
let _app = null;

let _registry = {};
function register(source, name) {
  if (includes(_registry[source], name)) {
    throw new Error(`@Factory Unable to register multiple ${name} instances for ${source}`);
  }

  if (_registry[source]) {
    _registry[source].push(name); // eslint-disable-line better-mutation/no-mutating-methods
  } else {
    _registry[source] = [name]; // eslint-disable-line better-mutation/no-mutation
  }
}

function getSource() {
  return _source;
}

function getSourceGenerator(value) {
  return _sourceGenerators[value || process.env.STELLAR_SOURCE_GENERATOR || _defaultSourceGenerator];
}

function configureTransport(transport, transportFactory, options) {
  _transport = transport || transportFactory(options); // eslint-disable-line better-mutation/no-mutation
  return _transport;
}

function configureStellar({ log, transport, transportFactory, source, sourceGenerator, app = process.env.APP, ...options }) {
  _registry = {}; // eslint-disable-line better-mutation/no-mutation
  _app = app; // eslint-disable-line better-mutation/no-mutation

  configureStellarLog(log);
  configureTransport(transport, transportFactory, assign({ log }, options));

  _source = source || getSourceGenerator(sourceGenerator)(_log); // eslint-disable-line better-mutation/no-mutation
  _log.info(`setting source ${_source}`);
  return _source;
}

function stellarAppPubSub() {
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
  return new StellarRequest(_transport, source, _log, requestTimeout, stellarNodePubSub(options));
}

function stellarHandler() {
  register(_source, 'stellarHandler');
  return new StellarHandler(_transport, _source, _log, _app);
}

function setSourceGenerators(defaultSourceGenerator, sourceGenerators) {
  _defaultSourceGenerator = defaultSourceGenerator; // eslint-disable-line better-mutation/no-mutation
  _sourceGenerators = sourceGenerators; // eslint-disable-line better-mutation/no-mutation
}

configureStellarLog(console);

export {
  stellarRequest,
  stellarHandler,
  stellarAppPubSub,
  configureStellar,
  getSource,
  setSourceGenerators,
};
