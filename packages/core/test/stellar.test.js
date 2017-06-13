import _ from 'lodash';
import Promise from 'bluebird';
import StellarCore from '../src/StellarCore';
import StellarPubSub from '../src/StellarPubSub';
import StellarRequest from '../src/StellarRequest';
import StellarHandler from '../src/StellarHandler';
import { StellarError } from '../src/StellarError';
import { createMockTransport } from './mocks';

const stellarRequest = new StellarRequest(createMockTransport(), 'test', console, 1000);
const stellarHandler = new StellarHandler(createMockTransport(true), 'test', console, 'testservice');
const defaultPubSub = new StellarPubSub(createMockTransport(), 'test', console);

const mockRequest = (obj, queueName) => {
    obj.transport.reset({ headers: { queueName, respondTo: 'myQueue', type:'request' }, body: { text: 'hi' } });
};

const mockPublish = (obj, channel) => {
  obj.transport.reset({ headers: { channel, respondTo: 'myQueue', type: 'publish' }, body: { text: 'hi' } });
};

const restoreQueues = (obj) => {
  stellarHandler.handlerChain = [];
  stellarRequest.handlerChain = [];

  if (obj instanceof StellarHandler) {
    StellarHandler.isProcessing = new Set();
  }
};

describe('mock request response', () => {
  // beforeEach(clearRedis);
  beforeEach(() => mockRequest(stellarRequest, 'testservice:resource:create'));
  afterEach(() => restoreQueues(stellarRequest));

  it('send request', (done) => {
    const result = stellarRequest.create('testservice:resource', { text: 'toot' });
    setTimeout(() => {
      expect(result.then).toBeInstanceOf(Function);
      const qName = StellarCore.getServiceInbox('testservice');
      const queue = stellarRequest.transport.queues[qName];
      const job = _.last(queue);

      expect(queue).toHaveLength(1);
      expect(job.jobId).toEqual(1);
      expect(job.data.headers.id).toEqual('testservice:1');
      expect(job.data.headers.queueName).toEqual('testservice:resource:create');
      expect(job.data.headers.respondTo).toEqual(StellarCore.getNodeInbox(stellarRequest.source));
      expect(job.data.headers.source).toEqual(stellarRequest.source);
      expect(job.data.body).toEqual({ text: 'toot' });
      done();
    }, 50); // takes a bit of time as it blocks on a semaphore before enqueuing
  });


  it('send request that doesnt respond in time', (done) => {
    const result = stellarRequest.update('testservice:resource', { text: 'toot' });
    expect(result.then).toBeInstanceOf(Function);

    result.then(() => {
      done(new Error('should send a StellarError 1'));
    }).catch(StellarError, (e) => {
      expect(e.message).toEqual('Timeout error: No response to job stlr:s:testservice:inbox:1 in 1000ms');
      done();
    }).catch(e => new Error('should send a StellarError 2'));
  });

  it('receive response', (done) => {
    const result = stellarRequest.create('testservice:resource', { text: 'toot' });
    Promise.delay(200).then(() => {
      const qName = StellarCore.getServiceInbox('testservice');
      const queue = stellarRequest.transport.queues[qName];
      const job = _.last(queue);
      expect(job.data.headers.id).toEqual(`testservice:${job.jobId}`);
      stellarRequest.inflightRequests[job.data.headers.id]({ data: { headers: {type: 'response'}, body: { text: 'world' } } });

      result
        .then(r => expect(r).toEqual({ text: 'world' }))
        .then(() => done());
    });
  });

  it('receive js error', (done) => {
    const result = stellarRequest.create('testservice:resource', { text: 'toot' });
    Promise.delay(200).then(() => {
      const qName = StellarCore.getServiceInbox('testservice');
      const queue = stellarRequest.transport.queues[qName];
      const job = _.last(queue);
      stellarRequest.inflightRequests[job.data.headers.id](
        { data: { headers: { type: 'response', errorType: 'Error' }, body: { message: 'blah' } } }
      );

      result
        .then(() => done(new Error('fail')))
        .catch(Error, (e) => {
          expect(e.message).toEqual('blah');
          done();
        });
    });
  });

  it('receive stellar error', (done) => {
    const result = stellarRequest.create('testservice:resource', { text: 'toot' });
    Promise.delay(200).then(() => {
      const qName = StellarCore.getServiceInbox('testservice');
      const queue = stellarRequest.transport.queues[qName];
      const job = _.last(queue);
      stellarRequest.inflightRequests[job.data.headers.id](
        { data: { headers: { type: 'response', errorType: 'StellarError' }, body: { message: 'blah', errors: { x: ['shit'] } } } }
      );

      result
        .then(() => done(new Error('fail')))
        .catch(StellarError, (e) => {
          expect(e.message).toEqual('blah');
          expect(e.errors).toEqual({ x: ['shit'] });
          done();
        });
    });
  });
});

describe('no-timeout behaviour on mock request response', () => {
  // beforeEach(clearRedis);

  // const noTimeoutStellarRequest = new StellarRequest(redisTransport, 'alttest', console);
  beforeEach(() => mockRequest(stellarRequest, 'testservice:resource:create'));
  beforeEach(() => stellarRequest.requestTimeout = undefined);
  afterEach(() => restoreQueues(stellarRequest));
  afterEach(() => stellarRequest.requestTimeout = 1000);
  // afterEach(() => restoreQueues(stellarRequest));

  it('send no-timeout request that responds', (done) => {
    const result = stellarRequest.create('testservice:resource', { text: 'toot' });
    Promise.delay(200).then(() => {
      const qName = StellarCore.getServiceInbox('testservice');
      const queue = stellarRequest.transport.queues[qName];
      const job = _.last(queue);
      stellarRequest.inflightRequests[job.data.headers.id]({ data: { headers: {type: 'response'},  body: { text: 'world' } } });

      result
        .then(r => expect(r).toEqual({ text: 'world' }))
        .then(() => done());
    });
  });

  it('send no-timeout request that doesnt respond', (done) => {
    const result = stellarRequest.update('alttestservice:resource', { text: 'toot' });
    expect(result.then).toBeInstanceOf(Function);

    result.then(() => {
      done(new Error('fail'));
    });

    Promise.delay(1500).then(() => {
      done();
    });
  });

});

describe('middlewares', () => {
  // beforeEach(clearRedis);
  beforeEach(() => mockRequest(stellarRequest));
  beforeEach(() => mockRequest(stellarHandler, 'testservice:resource:create'));
  afterEach(() => restoreQueues(stellarRequest));
  afterEach(() => restoreQueues(stellarHandler));

  it('use request mw', (done) => {
    stellarRequest.use('.*', (jobData, next) => {
      _.assign(jobData.headers, { userId: 1 });
      return next();
    });

    stellarRequest.get('testservice:resource', { text: 'toot' });

    Promise.delay(200).then(() => {
      const qName = StellarCore.getServiceInbox('testservice');
      const queue = stellarRequest.transport.queues[qName];
      const job = _.last(queue);

      expect(queue).toHaveLength(1);
      expect(job.jobId).toEqual(1);
      expect(job.data.headers.queueName).toEqual('testservice:resource:get');
      expect(job.data.headers.userId).toEqual(1);
      expect(job.data.headers.respondTo).toEqual(StellarCore.getNodeInbox(stellarRequest.source));
      expect(job.data.headers.source).toEqual(stellarRequest.source);
      expect(job.data.body).toEqual({ text: 'toot' });
      done();
    });
  });

  it('ignore unmatched mw', (done) => {
    const middlewareRun = {
      ".*:create": false,
      ".*:get": false,
      "testservice:resource:.*": false,
      "testservice:not:.*": false,
    };

    _.each(middlewareRun, (v, k) => {
      stellarRequest.use(k, (jobData, next) => {
        middlewareRun[k] = true;
        return next();
      });
    });

    stellarRequest.get('testservice:resource', { text: 'toot' });

    Promise.delay(200).then(() => {
      const qName = StellarCore.getServiceInbox('testservice');
      const queue = stellarRequest.transport.queues[qName];
      const job = _.last(queue);

      expect(queue).toHaveLength(1);
      expect(job.jobId).toEqual(1);
      expect(job.data.headers.queueName).toEqual('testservice:resource:get');
      expect(middlewareRun).toEqual({
                                         ".*:create": false,
                                         ".*:get": true,
                                         "testservice:resource:.*": true,
                                         "testservice:not:.*": false,
                                       });
      expect(job.data.headers.respondTo).toEqual(StellarCore.getNodeInbox(stellarRequest.source));
      expect(job.data.headers.source).toEqual(stellarRequest.source);
      expect(job.data.body).toEqual({ text: 'toot' });
      done();
    });
  });

  it('use handler mw', (done) => {
    let mwRequest;
    let mwResult;
    stellarHandler.use('.*', (jobData, next) => {
      mwRequest = _.clone(jobData);
      return next().then((result) => {
        mwResult = result.body;
        return result;
      });
    });

    stellarHandler.handleMethod('testservice:resource', 'create', (request) => {
      expect(request.body.text).toEqual('hi');
      return { text: 'world' };
    });

    Promise.delay(200).then(() => {
      expect(mwRequest.body).toEqual({ text: 'hi' });
      expect(mwResult).toEqual({ text: 'world' });
      done();
    });
  });

  it('reject error from handler mw ', (done) => {
    stellarHandler.use('.*', (jobData, next) => {
      return Promise.reject(new Error('boo hoo'));
    });

    stellarHandler.handleMethod('testservice:resource', 'create', (request) => {
      fail('shouldnt be called');
      // expect(request.body.text).toEqual('hi');
      return { text: 'world' };
    });

    Promise.delay(1000).then(() => {
      const qName = 'myQueue';
      const queue = stellarHandler.transport.queues[qName];
      const job = _.last(queue);

      expect(queue).toHaveLength(1);
      expect(job.jobId).toEqual(1);
      expect(job.queue).toEqual({ name: qName });
      expect(job.data.headers).not.toHaveProperty('respondTo');
      expect(job.data.headers).toHaveProperty('source'); // eslint-disable-line
      expect(job.data.headers.errorType).toEqual('Error'); // eslint-disable-line
      expect(job.data.body).toEqual({ message: 'boo hoo' });
      done();
    });
  });

  it('throw error from handler mw ', (done) => {
    stellarHandler.use('.*', (jobData, next) => {
      throw new Error('boo hoo');
    });

    stellarHandler.handleMethod('testservice:resource', 'create', (request) => {
      fail('shouldnt be called');
      // expect(request.body.text).toEqual('hi');
      return { text: 'world' };
    });

    Promise.delay(1000).then(() => {
      const qName = 'myQueue';
      const queue = stellarHandler.transport.queues[qName];
      const job = _.last(queue);

      expect(queue).toHaveLength(1);
      expect(job.jobId).toEqual(1);
      expect(job.queue).toEqual({ name: qName });
      expect(job.data.headers).not.toHaveProperty('respondTo');
      expect(job.data.headers).toHaveProperty('source'); // eslint-disable-line
      expect(job.data.headers.errorType).toEqual('Error'); // eslint-disable-line
      expect(job.data.body).toEqual({ message: 'boo hoo' });
      done();
    });
  });

  it('use handler mw in error state', (done) => {
    let mwRequest;
    let mwError;
    stellarHandler.use('.*', (jobData, next) => {
      mwRequest = _.clone(jobData);
      return next().catch(([error, response]) => {
        mwError = response.body;
        return Promise.reject([error, response]);
      });
    });

    stellarHandler.handleMethod('testservice:resource', 'create', (request) => {
      expect(request.body.text).toEqual('hi');
      throw new Error('terrible internal error');
    });

    Promise.delay(200).then(() => {
      expect(mwRequest.body).toEqual({ text: 'hi' });
      expect(mwError).toEqual({ message: 'terrible internal error' });
      done();
    });
  });


  it('use handler mw in stellar error state', (done) => {
    let mwRequest;
    let mwError;
    stellarHandler.use('.*', (jobData, next) => {
      mwRequest = _.clone(jobData);
      return next().catch(([error, response]) => {
        mwError = response.body;
        return Promise.reject([error, response]);
      });
    });

    stellarHandler.handleMethod('testservice:resource', 'create', (request) => {
      expect(request.body.text).toEqual('hi');
      throw new StellarError('simple validation error');
    });

    Promise.delay(200).then(() => {
      expect(mwRequest.body).toEqual({ text: 'hi' });
      expect(mwError).toEqual({ errors: {general: ['simple validation error']}, message: 'simple validation error' });
      done();
    });
  });
});

describe('mock handler', () => {
  // beforeEach(clearRedis);
  beforeEach(() => mockRequest(stellarHandler, 'testservice:resource:create'));
  afterEach(() => restoreQueues(stellarHandler));

  it('if a result is returned and a respondTo is set, send a response with the result', (done) => {
    stellarHandler.handleMethod('testservice:resource', 'create', (request) => {
      expect(request.body.text).toEqual('hi');
      return { text: 'world' };
    });

    Promise.delay(200).then(() => {
      const qName = 'myQueue';
      const queue = stellarHandler.transport.queues[qName];
      const job = _.last(queue);

      expect(queue).toHaveLength(1);
      expect(job.jobId).toEqual(1);
      expect(job.queue).toEqual({ name: qName });
      expect(job.data.headers).not.toHaveProperty('respondTo');
      expect(job.data.headers).toHaveProperty('source'); // eslint-disable-line
      expect(job.data.body).toEqual({ text: 'world' });
      done();
    });
  });


  it('if an error is returned and a respondTo is set, send a error response', (done) => {
    stellarHandler.handleMethod('testservice:resource', 'create', (request) => {
      expect(request.body.text).toEqual('hi');
      throw new Error('blah');
    });

    Promise.delay(200).then(() => {
      const qName = 'myQueue';
      const queue = stellarHandler.transport.queues[qName];
      const job = _.last(queue);

      expect(queue).toHaveLength(1);
      expect(job.jobId).toEqual(1);
      expect(job.queue).toEqual({ name: qName });
      expect(job.data.headers).not.toHaveProperty('respondTo');
      expect(job.data.headers).toHaveProperty('source'); // eslint-disable-line
      expect(job.data.headers.errorType).toEqual('Error');
      expect(job.data.body).toEqual({ message: 'blah' });
      done();
    });
  });

  it('if validationErrors are returned and a respondTo is set, send a error response', (done) => {
    stellarHandler.handleMethod('testservice:resource', 'create', (request) => {
      expect(request.body.text).toEqual('hi');
      const errors = new StellarError();
      errors.addPropertyError('x', 'blah');
      throw errors;
    });

    Promise.delay(200).then(() => {
      const qName = 'myQueue';
      const queue = stellarHandler.transport.queues[qName];
      const job = _.last(queue);

      expect(queue).toHaveLength(1);
      expect(job.jobId).toEqual(1);
      expect(job.queue).toEqual({ name: qName });
      expect(job.data.headers).not.toHaveProperty('respondTo');
      expect(job.data.headers).toHaveProperty('source'); // eslint-disable-line
      expect(job.data.headers.errorType).toEqual('StellarError');
      expect(job.data.body.errors).toEqual({ x: ['blah'] });
      done();
    });
  });
});

describe('mock pubsub', () => {
  const channel = 'testpubsub:channel';

  // beforeEach(clearRedis);
  beforeEach(() => mockPublish(defaultPubSub, channel));
  afterEach(() => restoreQueues(defaultPubSub));

  it('fake subscribe handler', (done) => {
    defaultPubSub.subscribe(channel, (message) => {
      expect(message.text).toEqual('hi');
      done();
    });
    
    setTimeout(
      () => defaultPubSub.transport.triggerJob(defaultPubSub.transport.job),
      5
    );
  });

  it('send fake publish - should send none', () => {
    defaultPubSub.publish(channel, { text: 'hi' });
    expect(_.keys(defaultPubSub.transport.queues)).toHaveLength(0);
  });

  it('send fake publish - should send one', (done) => {
    defaultPubSub.transport.registerSubscriber(channel, 'POO')
      .then(() => {
        defaultPubSub
          .publish(channel, { text: 'hi' })
          .then(() => {
            expect(_.keys(defaultPubSub.transport.queues)).toHaveLength(1);
            expect(_.head(_.keys(defaultPubSub.transport.queues))).toEqual('POO');
            done();
          });
      });
  });

  it('send fake publish - should send N', (done) => {
    Promise
      .all(_.range(10)
             .map(i => defaultPubSub.transport.registerSubscriber(channel, `POO.${i}`)))
      .then(() => defaultPubSub.publish(channel, { text: 'hi' }))
      .then(() => {
        expect(_.keys(defaultPubSub.transport.queues)).toHaveLength(10);
        done();
      });
  });
});
