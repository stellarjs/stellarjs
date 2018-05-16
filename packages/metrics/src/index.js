import isRegExp from 'lodash/isRegExp';
import isString from 'lodash/isString';

const ONE_MINUTE = 60 * 1000;
const PUBLISH_INTERVAL = process.env.STELLAR_METRICS_PUBLISH_INTERVAL || ONE_MINUTE;

let pubSubIntervalId;
let metrics = {};

function addMetricsURL(url) {
  if (!metrics[url]) {
    metrics[url] = { chunks: {} }; // eslint-disable-line better-mutation/no-mutation
  }
}

function addRequest(url) {
  addMetricsURL(url);

  metrics[url].requests = (metrics[url].requests || 0) + 1; // eslint-disable-line better-mutation/no-mutation
}

function addFailedRequest(url) {
  addMetricsURL(url);

  metrics[url].failedRequests = (metrics[url].failedRequests || 0) + 1; // eslint-disable-line better-mutation/no-mutation
}

export function resetMetrics() {
  metrics = {}; // eslint-disable-line better-mutation/no-mutation

  if (pubSubIntervalId) {
    clearInterval(pubSubIntervalId);
  }
}

export function getMetrics() {
  return metrics;
}

export function middleware(req, next) {
  addRequest(req.headers.queueName);

  return next()
      .catch((e) => {
        addFailedRequest(req.headers.queueName);
        throw e;
      });
}

function init({ handler, pubSub }, microServiceName, publishInterval, urlPatterns) {
  const startTime = Date.now();

  function prepareMetrics() {
    return { node: handler.source, startTime, metrics: getMetrics() };
  }

  resetMetrics();

  handler.use(urlPatterns, middleware);

  handler.get(`${microServiceName}:metrics`, () => prepareMetrics());

  if (pubSub) {
     // eslint-disable-next-line better-mutation/no-mutation
    pubSubIntervalId = setInterval(() => {
      pubSub.publish(`channel:${microServiceName}:metrics`, prepareMetrics());
    }, publishInterval);
  }
}

export default function ({ handler, pubSub }, microServiceName, publishInterval, ...urlPatterns) {
  if (isString(publishInterval) || isRegExp(publishInterval)) {
    return init({ handler, pubSub }, microServiceName, PUBLISH_INTERVAL, [publishInterval].concat(urlPatterns));
  }

  return init({ handler, pubSub }, microServiceName, publishInterval, urlPatterns);
}
