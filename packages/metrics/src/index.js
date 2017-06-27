import forEach from 'lodash/forEach';

let metrics = {};

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

export default function (stellarHandler, microServiceName, ...urlPatterns) {
  forEach(urlPatterns, (pattern) => {
    stellarHandler.use(pattern, middleware);
  });

  stellarHandler.get(`${microServiceName}:metrics`, () => ({ metrics: getMetrics() }));
}
