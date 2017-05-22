import { expect } from 'chai'; // eslint-disable-line
import chai from 'chai';  // eslint-disable-line
import chaiAsPromised from 'chai-as-promised'; // eslint-disable-line
import _ from 'lodash';
import Promise from 'bluebird';
import StellarCore from '../src/StellarCore';
import StellarPubSub from '../src/StellarPubSub';
import StellarRequest from '../src/StellarRequest';
import StellarHandler from '../src/StellarHandler';
import { StellarError } from '../src/StellarError';

const log = console;

chai.use(chaiAsPromised);
chai.should();

function createMockTransport(autoProcess) {
  return {
    queues: {},
    subscribers: {},
    jobCounter: 1,
    processData: {},

    reset(data) {
      this.job = { jobId: this.jobCounter++, data };
      this.queues = {};
      this.subscribers = {};
      this.jobCounter = 1;
    },

    getSubscribers(channel) {
      if (this.subscribers[channel] == null) {
        this.subscribers[channel] = new Set();
      }

      return Promise.resolve(this.subscribers[channel].values());
    },
    registerSubscriber(channel, queueName) {
      if (this.subscribers[channel] == null) {
        this.subscribers[channel] = new Set();
      }

      return Promise.resolve(this.subscribers[channel].add(queueName))
        .then(() => () => this._deregisterSubscriber(channel, queueName));
    },
    _deregisterSubscriber(channel, queueName) {
      if (this.subscribers[channel] == null) {
        this.subscribers[channel] = new Set();
      }
      return Promise.resolve(this.subscribers[channel].delete(queueName));
    },
    enqueue(queueName, data) {
      return new Promise((resolve) => {
        this.queues[queueName] = [{ data, jobId: this.jobCounter++, queue: { name: queueName } }];
        resolve(_.last(this.queues[queueName]));
      });
    },

    process(queueName, callback) {
      this.callback = callback;

      if (autoProcess) {
        setTimeout(() => this.triggerJob(this.job));
      }
      return new Promise.resolve();
    },

    triggerJob(job) {
      this.callback(job || this.job);
    }
  };
}

const stellarRequest = new StellarRequest(createMockTransport(), 'test', console, 1000);
const stellarHandler = new StellarHandler(createMockTransport(true), 'test', console, 'testservice');
const defaultPubSub = new StellarPubSub(createMockTransport(), 'test', console);

const mockQueues = (obj, channel) => {
    obj.transport.reset({ headers: { queueName: channel, respondTo: 'myQueue', channel }, body: { text: 'hi' } });
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
  beforeEach(() => mockQueues(stellarRequest, 'testservice:resource:create'));
  afterEach(() => restoreQueues(stellarRequest));
  it('send request', (done) => {
    const result = stellarRequest.create('testservice:resource', { text: 'toot' });
    setTimeout(() => {
      result.then.should.be.a('Function');
      const qName = StellarCore.getServiceInbox('testservice');
      const queue = stellarRequest.transport.queues[qName];
      const job = _.last(queue);

      _.size(queue).should.equal(1);
      job.jobId.should.equal(1);
      job.data.headers.queueName.should.equal('testservice:resource:create');
      job.data.headers.respondTo.should.equal(StellarCore.getNodeInbox(stellarRequest.source));
      job.data.headers.source.should.equal(stellarRequest.source);
      job.data.body.should.deep.equal({ text: 'toot' });
      done();
    }, 50); // takes a bit of time as it blocks on a semaphore before enqueuing
  });


  it('send request that doesnt respond in time', (done) => {
    const result = stellarRequest.update('testservice:resource', { text: 'toot' });
    result.then.should.be.a('Function');

    result.then(() => {
      done(new Error('fail'));
    }).catch(StellarError, (e) => {
      e.message.should.equal('Timeout error: No response to job 1 in 1000ms');
      done();
    });
  })

  it('receive response', (done) => {
    const result = stellarRequest.create('testservice:resource', { text: 'toot' });
    Promise.delay(200).then(() => {
      const qName = StellarCore.getServiceInbox('testservice');
      const queue = stellarRequest.transport.queues[qName];
      const job = _.last(queue);
      stellarRequest.inflightRequests[job.jobId]({ data: { body: { text: 'world' } } });

      result
        .then(r => r.should.deep.equal({ text: 'world' }))
        .then(() => done());
    });
  });

  it('receive js error', (done) => {
    const result = stellarRequest.create('testservice:resource', { text: 'toot' });
    Promise.delay(200).then(() => {
      const qName = StellarCore.getServiceInbox('testservice');
      const queue = stellarRequest.transport.queues[qName];
      const job = _.last(queue);
      stellarRequest.inflightRequests[job.jobId](
        { data: { headers: { errorType: 'Error' }, body: { message: 'blah' } } }
      );

      result
        .then(() => done(new Error('fail')))
        .catch(Error, (e) => {
          e.message.should.equal('blah');
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
      stellarRequest.inflightRequests[job.jobId](
        { data: { headers: { errorType: 'StellarError' }, body: { message: 'blah', errors: { x: ['shit'] } } } }
      );

      result
        .then(() => done(new Error('fail')))
        .catch(StellarError, (e) => {
          e.message.should.equal('blah');
          e.errors.should.deep.equal({ x: ['shit'] });
          done();
        });
    });
  });
});

describe('no-timeout behaviour on mock request response', () => {
  // beforeEach(clearRedis);

  // const noTimeoutStellarRequest = new StellarRequest(redisTransport, 'alttest', console);
  beforeEach(() => mockQueues(stellarRequest, 'testservice:resource:create'));
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
      stellarRequest.inflightRequests[job.jobId]({ data: { body: { text: 'world' } } });

      result
        .then(r => r.should.deep.equal({ text: 'world' }))
        .then(() => done());
    });

  });

  it('send no-timeout request that doesnt respond', (done) => {
    const result = stellarRequest.update('alttestservice:resource', { text: 'toot' });
    result.then.should.be.a('Function');

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
  beforeEach(() => mockQueues(stellarRequest));
  beforeEach(() => mockQueues(stellarHandler, 'testservice:resource:create'));
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

      _.size(queue).should.equal(1);
      job.jobId.should.equal(1);
      job.data.headers.queueName.should.equal('testservice:resource:get');
      job.data.headers.userId.should.equal(1);
      job.data.headers.respondTo.should.equal(StellarCore.getNodeInbox(stellarRequest.source));
      job.data.headers.source.should.equal(stellarRequest.source);
      job.data.body.should.deep.equal({ text: 'toot' });
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

      _.size(queue).should.equal(1);
      job.jobId.should.equal(1);
      job.data.headers.queueName.should.equal('testservice:resource:get');
      middlewareRun.should.deep.equals({
                                         ".*:create": false,
                                         ".*:get": true,
                                         "testservice:resource:.*": true,
                                         "testservice:not:.*": false,
                                       });
      job.data.headers.respondTo.should.equal(StellarCore.getNodeInbox(stellarRequest.source));
      job.data.headers.source.should.equal(stellarRequest.source);
      job.data.body.should.deep.equal({ text: 'toot' });
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
      request.body.text.should.equal('hi');
      return { text: 'world' };
    });

    Promise.delay(200).then(() => {
      mwRequest.body.should.deep.equal({ text: 'hi' });
      mwResult.should.deep.equal({ text: 'world' });
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
      request.body.text.should.equal('hi');
      throw new Error('terrible internal error');
    });

    Promise.delay(200).then(() => {
      mwRequest.body.should.deep.equal({ text: 'hi' });
      mwError.should.deep.equal({ message: 'terrible internal error' });
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
      request.body.text.should.equal('hi');
      throw new StellarError('simple validation error');
    });

    Promise.delay(200).then(() => {
      mwRequest.body.should.deep.equal({ text: 'hi' });
      mwError.should.deep.equal({ errors: {general: ['simple validation error']}, message: 'simple validation error' });
      done();
    });
  });
});

describe('mock handler', () => {
  // beforeEach(clearRedis);
  beforeEach(() => mockQueues(stellarHandler, 'testservice:resource:create'));
  afterEach(() => restoreQueues(stellarHandler));

  it('calls the passed in handler', (done) => {
    stellarHandler.create('testservice:resource', (request) => {
      request.body.text.should.equal('hi');
      done();
    });
  });

  it('if a result is returned and a respondTo is set, send a response with the result', (done) => {
    stellarHandler.handleMethod('testservice:resource', 'create', (request) => {
      request.body.text.should.equal('hi');
      return { text: 'world' };
    });

    Promise.delay(200).then(() => {
      const qName = 'myQueue';
      const queue = stellarHandler.transport.queues[qName];
      const job = _.last(queue);

      _.size(queue).should.equal(1);
      job.jobId.should.equal(1);
      job.queue.should.deep.equal({ name: qName });
      job.data.headers.should.not.have.a.property('respondTo');
      job.data.headers.source.should.be.present; // eslint-disable-line
      job.data.body.should.deep.equal({ text: 'world' });
      done();
    });
  });


  it('if an error is returned and a respondTo is set, send a error response', (done) => {
    stellarHandler.handleMethod('testservice:resource', 'create', (request) => {
      request.body.text.should.equal('hi');
      throw new Error('blah');
    });

    Promise.delay(200).then(() => {
      const qName = 'myQueue';
      const queue = stellarHandler.transport.queues[qName];
      const job = _.last(queue);

      _.size(queue).should.equal(1);
      job.jobId.should.equal(1);
      job.queue.should.deep.equal({ name: qName });
      job.data.headers.should.not.have.a.property('respondTo');
      job.data.headers.source.should.be.present; // eslint-disable-line
      job.data.headers.errorType.should.equal('Error');
      job.data.body.should.deep.equal({ message: 'blah' });
      done();
    });
  });

  it('if validationErrors are returned and a respondTo is set, send a error response', (done) => {
    stellarHandler.handleMethod('testservice:resource', 'create', (request) => {
      request.body.text.should.equal('hi');
      const errors = new StellarError();
      errors.addPropertyError('x', 'blah');
      throw errors;
    });

    Promise.delay(200).then(() => {
      const qName = 'myQueue';
      const queue = stellarHandler.transport.queues[qName];
      const job = _.last(queue);

      _.size(queue).should.equal(1);
      job.jobId.should.equal(1);
      job.queue.should.deep.equal({ name: qName });
      job.data.headers.should.not.have.a.property('respondTo');
      job.data.headers.source.should.be.present; // eslint-disable-line
      job.data.headers.errorType.should.equal('StellarError');
      job.data.body.errors.should.deep.equal({ x: ['blah'] });
      done();
    });
  });
});

describe('mock pubsub', () => {
  const channel = 'testpubsub:channel';

  // beforeEach(clearRedis);
  beforeEach(() => mockQueues(defaultPubSub, channel));
  afterEach(() => restoreQueues(defaultPubSub));

  it('fake subscribe handler', (done) => {
    defaultPubSub.subscribe(channel, (message) => {
      message.text.should.equal('hi');
      done();
    });
    
    setTimeout(
      () => defaultPubSub.transport.triggerJob(defaultPubSub.transport.job),
      5
    );
  });

  it('send fake publish - should send none', () => {
    defaultPubSub.publish(channel, { text: 'hi' });
    _.size(defaultPubSub.transport.queues).should.equal(0);
  });

  it('send fake publish - should send one', (done) => {
    defaultPubSub.transport.registerSubscriber(channel, 'POO')
      .then(() => {
        defaultPubSub
          .publish(channel, { text: 'hi' })
          .then(() => {
            _.size(defaultPubSub.transport.queues).should.equal(1);
            _.head(_.keys(defaultPubSub.transport.queues)).should.equal('POO');
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
        _.size(defaultPubSub.transport.queues).should.equal(10);
        done();
      });
  });
});
