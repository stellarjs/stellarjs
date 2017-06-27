/**
 * Created by ozsayag on 26/06/2017.
 */
import { StellarRequest, StellarHandler } from '@stellarjs/core';
import { MemoryTransport } from '@stellarjs/transport-memory';
import Promise from 'bluebird';


import runMetrics, { resetMetrics, middleware, getMetrics } from '../src';

function createStellar() {
  const memoryTransport = new MemoryTransport();
  const request = new StellarRequest(memoryTransport, 'test', console, 1000);
  const handler = new StellarHandler(memoryTransport, 'test', console, 1000);

  return { handler, request };
}

describe('metrics', () => {
  const service = 'test';
  const resource1 = `${service}:resource`;
  const resource2 = `${service}:resource2`;

  afterEach(() => {
    resetMetrics();
    StellarHandler.isProcessing = new Set();
  });

  it('calls metrics middleware by pattern', () => {
    const stellar = createStellar();
    stellar.handler.get(resource1, () => {});

    runMetrics(stellar.handler, service, '.*');

    return stellar.request.get(resource1)
        .then(() => {
          expect(getMetrics()[`${resource1}:get`].requests).toBe(1);
        });
  });

  it('calls metrics middleware manually', () => {
    const stellar = createStellar();
    stellar.handler.get(resource1, () => {});

    runMetrics(stellar.handler, service);
    stellar.handler.use('.*', middleware);

    return stellar.request.get(resource1)
        .then(() => {
          expect(getMetrics()[`${resource1}:get`].requests).toBe(1);
        });
  });

  it('sets metrics to 1 after 1 request', () => {
    const stellar = createStellar();
    stellar.handler.get(resource1, () => {});

    runMetrics(stellar.handler, service, '.*');

    return stellar.request.get(resource1)
        .then(() => {
          expect(getMetrics()[`${resource1}:get`].requests).toBe(1);
        });
  });

  it('sets metrics to 2 after 2 requests', () => {
    const stellar = createStellar();
    stellar.handler.get(resource1, () => {});

    runMetrics(stellar.handler, service, '.*');

    return Promise.all([stellar.request.get(resource1), stellar.request.get(resource1)])
        .then(() => {
          expect(getMetrics()[`${resource1}:get`].requests).toBe(2);
        });
  });

  it('sets metrics to 1 foreach url after 1 request per url', () => {
    const stellar = createStellar();
    stellar.handler.get(resource1, () => {});
    stellar.handler.get(resource2, () => {});

    runMetrics(stellar.handler, service, '.*');

    return Promise.all([stellar.request.get(resource1), stellar.request.get(resource2)])
        .then(() => {
          expect(getMetrics()[`${resource1}:get`].requests).toBe(1);
          expect(getMetrics()[`${resource2}:get`].requests).toBe(1);
        });
  });

  it('sets metrics to 1 after 1 request, a reset and a request', () => {
    const stellar = createStellar();
    stellar.handler.get(resource1, () => {});

    runMetrics(stellar.handler, service, '.*');

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

  it('gets metrics from the endpoint', () => {
    const stellar = createStellar();
    stellar.handler.get(resource1, () => {});

    runMetrics(stellar.handler, service, '.*');

    return stellar.request.get(resource1)
        .then(() => stellar.request.get(`${service}:metrics`))
        .then(({ metrics }) => {
          expect(metrics[`${resource1}:get`].requests).toBe(1);
        });
  });

  it('sets failed metrics to 1 after 1 failed request', () => {
    const stellar = createStellar();
    stellar.handler.get(resource1, () => { throw new Error(); });

    runMetrics(stellar.handler, service, '.*');

    return stellar.request.get(resource1)
        .catch(() => {
          expect(getMetrics()[`${resource1}:get`].failedRequests).toBe(1);
          expect(getMetrics()[`${resource1}:get`].requests).toBe(1);
        });
  });
});