/**
 * Created by arolave on 05/10/2016.
 */
/* eslint-disable */
import forEach from 'lodash/forEach';
import get from 'lodash/get';
import size from 'lodash/size';
import assign from 'lodash/assign';

import Promise from 'bluebird';

import StellarHandler from './StellarHandler';
import StellarPubSub from './StellarPubSub';
import StellarRequest from './StellarRequest';

const requestTimeout = process.env.STELLAR_REQUEST_TIMEOUT || 30000;

let _log = console;
function configureStellarLog(stellarLog) {
  if (stellarLog) {
    _log = stellarLog;
  }
}

let _defaultSourceGenerator = null;
let _sourceGenerators = null;
let _source = null;
let _transport = null;
let _app = null;
const StellarServer = { instances: {} };

function doSetSource(s) {
  _source = s;

  forEach(['stellarRequest', 'stellarHandler', 'stellarAppPubSub', 'stellarNodePubSub'], (name) => {
    const instance = get(StellarServer.instances, name);
    if (instance) {
      _log.info(`setting source on ${name}`);
      instance.setSource(s);
    }
  });
}

function getSourceGenerator(value) {
  return _sourceGenerators[ value || process.env.STELLAR_SOURCE_GENERATOR || _defaultSourceGenerator ];
}

function configureTransport(transport, transportFactory, options) {
  _transport = transport || transportFactory(options);
  _log.info(`setting transport ${_transport}`);
  return _transport;
}

function configureStellar({ log, transport, transportFactory, source, sourceGenerator, app = process.env.APP, ...options }) {
  _app = app;

  configureStellarLog(log);
  configureTransport(transport, transportFactory, assign({log}, options));

  if (source) {
    _log.info(`setting source ${_source}`);
    return Promise.resolve(doSetSource(source));  // overrides generated source
  } else {
    return getSourceGenerator(sourceGenerator)(_log).then((generatedSource) => {
      _log.info(`setting source ${generatedSource}`);
      return doSetSource(generatedSource);
    });
  }
}

function _getInstance(name, builder) {
  if (!StellarServer.instances[name]) {
    StellarServer.instances[name] = builder.apply();
  }
  return StellarServer.instances[name];
}

function resetCache() {
  _log.info(`@factory.resetCache`);
  _source = null;
  for (let key in StellarServer.instances) {
    delete StellarServer.instances[key];
  }
  _log.info(size(StellarServer.instances));
}

function stellarAppPubSub() {
  return _getInstance('stellarAppPubSub', () => new StellarPubSub(_transport, _source, _log, _app));
}

function stellarNodePubSub() {
  return _getInstance('stellarNodePubSub', () => new StellarPubSub(_transport, _source, _log));
}

function stellarRequest() {
  _log.info(`stellarRequest creation source=${_source}`);
  return _getInstance('stellarRequest',
                      () => new StellarRequest(_transport, _source, _log, requestTimeout, stellarNodePubSub()));
}

function stellarHandler() {
  return _getInstance('stellarHandler', () => new StellarHandler(_transport, _source, _log, _app));
}

function stellarPublish() {
  return _getInstance('stellarPublish', () => {
    const pubsub = stellarAppPubSub();
    return pubsub.publish.bind(pubsub);
  });
}

function stellarSubscribe() {
  return _getInstance('stellarSubscribe', () => {
    const pubsub = stellarAppPubSub();
    return pubsub.subscribe.bind(pubsub);
  });
}

function stellarSource() {
  return stellarRequest().source;
}

function setSourceGenerators(defaultSourceGenerator, sourceGenerators) {
  _defaultSourceGenerator = defaultSourceGenerator;
  _sourceGenerators = sourceGenerators;
}

configureStellarLog(console);

export {
  stellarRequest,
  stellarHandler,
  stellarAppPubSub,
  stellarNodePubSub,
  configureStellar,
  stellarPublish,
  stellarSubscribe,
  stellarSource,
  resetCache,
  setSourceGenerators,
};
