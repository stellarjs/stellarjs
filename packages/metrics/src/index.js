import forEach from 'lodash/forEach';

let metrics = {};
const ONE_MINUTE = 60 * 1000;
const PUBLISH_INTERVAL = process.env.STELLAR_METRICS_PUBLISH_INTERVAL || ONE_MINUTE;
let pubSubIntervalId;

function addMetricsURL(url) {
  if (!metrics[url]) {
    metrics[url] = { chunks: {} };
  }
}

function addRequest(url) {
  addMetricsURL(url);

  metrics[url].requests = (metrics[url].requests || 0) + 1;
}

function addFailedRequest(url) {
  addMetricsURL(url);

  metrics[url].failedRequests = (metrics[url].failedRequests || 0) + 1;
}

export function resetMetrics() {
  metrics = {};

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

export default function ({ handler, pubSub }, microServiceName, publishInterval, ...urlPatterns) {
  if (typeof publishInterval === 'string') {
    urlPatterns.unshift(publishInterval);
    publishInterval = PUBLISH_INTERVAL; // eslint-disable-line no-param-reassign
  }

  const startTime = Date.now();

  function prepareMetrics() {
    return { node: handler.source, startTime, metrics: getMetrics() };
  }

  resetMetrics();

  forEach(urlPatterns, (pattern) => {
    handler.use(pattern, middleware);
  });

  handler.get(`${microServiceName}:metrics`, () => prepareMetrics());

  if (pubSub) {
    pubSubIntervalId = setInterval(() => {
      pubSub.publish(`channel:${microServiceName}:metrics`, prepareMetrics());
    }, publishInterval);
  }
}
