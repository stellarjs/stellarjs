/**
 * Created by ozsayag on 26/06/2017.
 */
import { StellarRequest, StellarHandler, StellarPubSub } from '@stellarjs/core';
import { MemoryTransport } from '@stellarjs/transport-memory';
import Promise from 'bluebird';

import runMetrics, { resetMetrics, middleware, getMetrics } from '../src';
import { QueueMessagingAdaptor } from '../../messaging-queue/lib-es6';

const service = 'service';
const source = 'test';

function createStellar() {
  const memoryTransport = new MemoryTransport(console);
  const messaging = new QueueMessagingAdaptor(memoryTransport, 'test', console, 1000);

  const request = new StellarRequest(messaging, source, console);
  const handler = new StellarHandler(messaging, source, console);
  const pubSub = new StellarPubSub(messaging, source, console);

  return { messaging, handler, request, pubSub };
}

describe('metrics', () => {
  let stellar;
  const resource1 = `${service}:resource`;
  const resource2 = `${service}:resource2`;

  beforeEach(() => {
    stellar = createStellar();
  });

  afterEach(() => {
    resetMetrics();
    stellar.messaging.reset();
  });

  it('calls metrics middleware by pattern', () => {
    runMetrics({ handler: stellar.handler }, service, '.*');

    stellar.handler.get(resource1, () => {});
    return stellar.request.get(resource1)
        .then(() => {
          expect(getMetrics()[`${resource1}:get`].requests).toBe(1);
        });
  });

  it('calls metrics middleware by multiple patterns', () => {
    runMetrics({ handler: stellar.handler }, service, `${resource1}:get`, `${resource2}:get`);

    stellar.handler.get(resource1, () => 1);
    stellar.handler.get(resource2, () => 2);
    return Promise.all([stellar.request.get(resource1), stellar.request.get(resource2)])
        .then(([res1, res2]) => {
          expect(res1).toEqual(1);
          expect(res2).toEqual(2);
          expect(getMetrics()[`${resource1}:get`].requests).toBe(1);
          expect(getMetrics()[`${resource2}:get`].requests).toBe(1);
        });
  });

  it('calls metrics middleware manually', () => {
    runMetrics({ handler: stellar.handler }, service);
    stellar.handler.use('.*', middleware);

    stellar.handler.get(resource1, () => {});
    return stellar.request.get(resource1)
        .then(() => {
          expect(getMetrics()[`${resource1}:get`].requests).toBe(1);
        });
  });

  it('sets metrics to 1 after 1 request', () => {
    runMetrics({ handler: stellar.handler }, service, '.*');

    stellar.handler.get(resource1, () => {});
    return stellar.request.get(resource1)
        .then(() => {
          expect(getMetrics()[`${resource1}:get`].requests).toBe(1);
        });
  });

  it('sets metrics to 2 after 2 requests', () => {
    runMetrics({ handler: stellar.handler }, service, '.*');

    stellar.handler.get(resource1, () => {});
    return Promise.all([stellar.request.get(resource1), stellar.request.get(resource1)])
        .then(() => {
          expect(getMetrics()[`${resource1}:get`].requests).toBe(2);
        });
  });

  it('sets metrics to 1 foreach url after 1 request per url', () => {
    runMetrics({ handler: stellar.handler }, service, '.*');

    stellar.handler.get(resource1, () => {});
    stellar.handler.get(resource2, () => {});
    return Promise.all([stellar.request.get(resource1), stellar.request.get(resource2)])
        .then(() => {
          expect(getMetrics()[`${resource1}:get`].requests).toBe(1);
          expect(getMetrics()[`${resource2}:get`].requests).toBe(1);
        });
  });

  it('doesn\'t set metrics on ignored endpoint', () => {
    runMetrics({ handler: stellar.handler }, service, `${resource2}:get`);

    stellar.handler.get(resource1, () => {});
    return stellar.request.get(resource1)
        .then(() => {
          expect(getMetrics()[`${resource1}:get`]).not.toBeDefined();
        });
  });

  it('doesn\'t set metrics on ignored endpoint but set it on not ignored endpoint', () => {
    runMetrics({ handler: stellar.handler }, service, `${resource1}:get`);

    stellar.handler.get(resource1, () => {});
    stellar.handler.get(resource2, () => {});
    return Promise.all([stellar.request.get(resource1), stellar.request.get(resource2)])
        .then(() => {
          expect(getMetrics()[`${resource1}:get`].requests).toBe(1);
          expect(getMetrics()[`${resource2}:get`]).not.toBeDefined();
        });
  });

  it('sets metrics to 1 after 1 request, a reset and a request', () => {
    runMetrics({ handler: stellar.handler }, service, '.*');

    stellar.handler.get(resource1, () => {});
    return stellar.request.get(resource1)
        .then(() => {
          expect(getMetrics()[`${resource1}:get`].requests).toBe(1);
        })
        .then(() => resetMetrics())
        .then(() => stellar.request.get(resource1))
        .then(() => {
          expect(getMetrics()[`${resource1}:get`].requests).toBe(1);
        });
  });

  it('gets metrics from the metrics endpoint', () => {
    runMetrics({ handler: stellar.handler }, service, '.*');

    stellar.handler.get(resource1, () => {});
    return stellar.request.get(resource1)
        .then(() => stellar.request.get(`${service}:metrics`))
        .then(({ metrics, node }) => {
          console.log(node);
          expect(metrics[`${resource1}:get`].requests).toBe(1);
        });
  });

  it('sets failed metrics to 1 after 1 failed request', () => {
    runMetrics({ handler: stellar.handler }, service, '.*');

    stellar.handler.get(resource1, () => { throw new Error(); });
    return stellar.request.get(resource1)
        .catch(() => {
          expect(getMetrics()[`${resource1}:get`].failedRequests).toBe(1);
          expect(getMetrics()[`${resource1}:get`].requests).toBe(1);
        });
  });

  it('gets metrics from the subscription', (done) => {
    runMetrics({ handler: stellar.handler, pubSub: stellar.pubSub }, service, 100, '.*');

    stellar.pubSub.subscribe(`channel:${service}:metrics`, () => {
      done();
    });
  });
});
