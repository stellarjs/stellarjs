/**
 * Created by arolave on 05/10/2016.
 */
/* eslint-disable */
import http from 'http';
import uuid from 'uuid';
import Promise from 'bluebird';
import _ from 'lodash';

import StellarHandler from './StellarHandler';
import StellarPubSub from './StellarPubSub';
import StellarRequest from './StellarRequest';

const requestTimeout = process.env.STELLAR_REQUEST_TIMEOUT || 3000;

let log = null;
function configureStellarLog(serverLog) {
  if (serverLog) {
    log = serverLog;
  }
}
configureStellarLog(console);

function generateSource() {
  const getFromInstanceId = (instanceId) => {
    const app = process.env.APP;
    return app ? `${app}:${instanceId}` : instanceId;
  };

  if (process.env.NODE_ENV === 'test') {
    log.info(`@StellarCore: sending request`);
    log.info(`@StellarCore Running test`);
    return Promise.resolve(getFromInstanceId(uuid.v4()));
  }

  return new Promise((resolve) => {
    http.get({ host: 'http://169.254.169.254', path: '/latest/meta-data/instance-id', timeout: 1000 }, (res) => {
      if (res.statusCode !== 200) {
        log.info(`@StellarCore: Running standard`);
        resolve(getFromInstanceId(uuid.v4()));
      }

      res.setEncoding('utf8');
      let body = '';
      res.on('data', (data) => {
        log.info(`@StellarCore: data ${data}`);
        body += data;
      });
      res.on('end', () => {
        log.info(`@StellarCore: Running in AWS`);
        log.info(`@StellarCore: end ${body}`);
        resolve(getFromInstanceId(body));
      });
    }).on('error', () => {
      log.info(`@StellarCore: Running standard`);
      resolve(getFromInstanceId(uuid.v4()));
    });
  });
}

let setSource = null;

const StellarServer = { instances: {} };

function doSetSource(s) {
  setSource = s;

  _.forEach(['stellarRequest', 'stellarHandler', 'stellarAppPubSub', 'stellarNodePubSub'], (name) => {
    const instance = _.get(StellarServer.instances, name);
    if (instance) {
      log.info(`setting source on ${name}`);
      instance.setSource(s);
    }
  });
}

function configureStellar(_log, _source) {
  configureStellarLog(_log);
  if (_source) {
    doSetSource(_source);  // overrides generated source
  }
}

generateSource().then((source) => {
  log.info(`setting source ${source}`);
  doSetSource(source);
});

function _getInstance(name, builder) {
  if (!StellarServer.instances[name]) {
    StellarServer.instances[name] = builder.apply();
  }
  return StellarServer.instances[name];
}

function stellarAppPubSub(transportFactory, app = process.env.APP) {
  return _getInstance('stellarAppPubSub', () => new StellarPubSub(transportFactory(log), setSource, log, app));
}

function stellarNodePubSub(transportFactory) {
  return _getInstance('stellarNodePubSub', () => new StellarPubSub(transportFactory(log), setSource, log));
}

function stellarRequest(transportFactory) {
  console.log(`stellarRequest creation ${setSource}`);
  return _getInstance('stellarRequest',
                      () => new StellarRequest(transportFactory(log), setSource, log, requestTimeout, stellarNodePubSub(transportFactory)));
}

function stellarHandler(transportFactory, app = process.env.APP) {
  return _getInstance('stellarHandler', () => new StellarHandler(transportFactory(log), setSource, log, app));
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

export {
  stellarRequest,
  stellarHandler,
  stellarAppPubSub,
  stellarNodePubSub,
  configureStellar,
  stellarPublish,
  stellarSubscribe,
  stellarSource,
};
