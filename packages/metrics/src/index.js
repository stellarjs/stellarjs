import forEach from 'lodash/forEach';

let metrics = {};
const PUBLISH_INTERVAL = process.env.METRICS_PUBLISH_INTERVAL || 100;
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

export default function ({ handler, pubSub }, microServiceName, ...urlPatterns) {
  resetMetrics();

  const startTime = Date.now();

  forEach(urlPatterns, (pattern) => {
    handler.use(pattern, middleware);
  });

  handler.get(`${microServiceName}:metrics`, () => ({ startTime, metrics: getMetrics() }));

  if (pubSub) {
    pubSubIntervalId = setInterval(() => {
      pubSub.publish(`channel:${microServiceName}:metrics`, { startTime, metrics: getMetrics() });
    }, PUBLISH_INTERVAL);
  }
}
