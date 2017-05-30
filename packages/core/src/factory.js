/**
 * Created by arolave on 05/10/2016.
 */
/* eslint-disable */
import forEach from 'lodash/forEach';
import get from 'lodash/get';
import size from 'lodash/size';

import StellarHandler from './StellarHandler';
import StellarPubSub from './StellarPubSub';
import StellarRequest from './StellarRequest';

const requestTimeout = process.env.STELLAR_REQUEST_TIMEOUT || 30000;

let _log = null;
function configureStellarLog(stellarLog) {
  if (stellarLog) {
    _log = stellarLog;
  }
}

let _defaultSourceGenerator = null;
let _sourceGenerators = null;
let _source = null;
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
  return _sourceGenerators[ value || process.env.STELLAR_SOURCE_GENERATOR || defaultSourceGenerator ];
}

function configureStellar({ log, source, sourceGenerator }) {
  configureStellarLog(log);

  if (source) {
    _log.info(`setting source ${_source}`);
    doSetSource(source);  // overrides generated source
  } else {
    getSourceGenerator(sourceGenerator)(_log).then((generatedSource) => {
      _log.info(`setting source ${generatedSource}`);
      doSetSource(generatedSource);
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

function stellarAppPubSub(transportFactory, app = process.env.APP) {
  return _getInstance('stellarAppPubSub', () => new StellarPubSub(transportFactory(_log), _source, _log, app));
}

function stellarNodePubSub(transportFactory) {
  return _getInstance('stellarNodePubSub', () => new StellarPubSub(transportFactory(_log), _source, _log));
}

function stellarRequest(transportFactory) {
  _log.info(`stellarRequest creation ${_source}`);
  return _getInstance('stellarRequest',
                      () => new StellarRequest(transportFactory(_log), _source, _log, requestTimeout, stellarNodePubSub(transportFactory)));
}

function stellarHandler(transportFactory, app = process.env.APP) {
  return _getInstance('stellarHandler', () => new StellarHandler(transportFactory(_log), _source, _log, app));
}

function stellarPublish(transportFactory, app) {
  return _getInstance('stellarPublish', () => {
    const pubsub = stellarAppPubSub(transportFactory, app);
    return pubsub.publish.bind(pubsub);
  });
}

function stellarSubscribe(transportFactory, app) {
  return _getInstance('stellarSubscribe', () => {
    const pubsub = stellarAppPubSub(transportFactory, app);
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
