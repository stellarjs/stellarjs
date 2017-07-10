import _ from 'lodash';
import Promise from 'bluebird';
import StellarCore from '../src/StellarCore';
import StellarPubSub from '../src/StellarPubSub';
import StellarRequest from '../src/StellarRequest';
import StellarHandler from '../src/StellarHandler';
import { StellarError } from '../src/StellarError';
import { MockTransport } from './mocks';

const getStellarRequest = () => new StellarRequest(new MockTransport(), 'test', console, 1000);
const getStellarHandler = (queueName, body = { text: 'hi' }) => {
  const transport = new MockTransport({ headers: { queueName, respondTo: 'myQueue', type:'request' }, body  }, true);
  StellarHandler.isProcessing = new Set();
  return new StellarHandler(transport, 'test', console, 1000);
};
const getDefaultPubSub = (channel, body = { text: 'hi' }) => {
  const transport = new MockTransport({ headers: { channel, type: 'publish' }, body });
  return new StellarPubSub(transport, 'test', console, 1000);
};

describe('mock request response', () => {
  it('send request', (done) => {
    const stellarRequest = getStellarRequest();
    const result = stellarRequest.create('testservice:resource', { text: 'toot' });
    setTimeout(() => {
      expect(result.then).toBeInstanceOf(Function);
      const qName = StellarCore.getServiceInbox('testservice');
      const queue = stellarRequest.transport.queues[qName];
      const job = _.last(queue);

      expect(queue).toHaveLength(1);
      expect(job.data.headers.id).toEqual('stlr:s:testservice:inbox:1');
      expect(job.data.headers.queueName).toEqual('testservice:resource:create');
      expect(job.data.headers.respondTo).toEqual(StellarCore.getNodeInbox(stellarRequest.source));
      expect(job.data.headers.source).toEqual(stellarRequest.source);
      expect(job.data.body).toEqual({ text: 'toot' });
      done();
    }, 50); // takes a bit of time as it blocks on a semaphore before enqueuing
  });

  it('send request that doesnt respond in time', (done) => {
    const stellarRequest = getStellarRequest();
    const result = stellarRequest.update('testservice:resource', { text: 'toot' });
    expect(result.then).toBeInstanceOf(Function);

    result.then(() => {
      fail('should send a StellarError 1');
    }).catch(StellarError, (e) => {
      expect(e.message).toEqual('Timeout error: No response to job stlr:s:testservice:inbox:1 in 1000ms');
      done();
    });
  });

  it('receive response', (done) => {
    const stellarRequest = getStellarRequest();
    const result = stellarRequest.create('testservice:resource', { text: 'toot' });
    Promise.delay(200).then(() => {
      const qName = StellarCore.getServiceInbox('testservice');
      const queue = stellarRequest.transport.queues[qName];
      const job = _.last(queue);
      expect(job.data.headers.id).toEqual(`stlr:s:testservice:inbox:1`);
      stellarRequest.inflightRequests[job.data.headers.id]({ data: { headers: {type: 'response'}, body: { text: 'world' } } });

      result
        .then(r => expect(r).toEqual({ text: 'world' }))
        .then(() => done());
    });
  });

  it('receive response array', (done) => {
    const stellarRequest = getStellarRequest();
    const result = stellarRequest.create('testservice:resource', [{ text: 'toot' }]);
    Promise.delay(200).then(() => {
      const qName = StellarCore.getServiceInbox('testservice');
      const queue = stellarRequest.transport.queues[qName];
      const job = _.last(queue);
      expect(job.data.headers.id).toEqual(`stlr:s:testservice:inbox:1`);
      stellarRequest.inflightRequests[job.data.headers.id]({ data: { headers: {type: 'response'}, body: [{ text: 'world' }] } });

      result
        .then(r => expect(r).toEqual([{ text: 'world' }]))
        .then(() => done());
    });
  });

  it('receive js error', (done) => {
    const stellarRequest = getStellarRequest();

    const result = stellarRequest.create('testservice:resource', { text: 'toot' });
    Promise.delay(200).then(() => {
      const qName = StellarCore.getServiceInbox('testservice');
      const queue = stellarRequest.transport.queues[qName];
      const job = _.last(queue);
      stellarRequest.inflightRequests[job.data.headers.id](
        { data: { headers: { type: 'response', errorType: 'Error' }, body: { message: 'blah' } } }
      );

      result
        .then(() => fail('error'))
        .catch(Error, (e) => {
          expect(e.message).toEqual('blah');
          done();
        })
    });
  });

  it('receive stellar error', (done) => {
    const stellarRequest = getStellarRequest();

    const result = stellarRequest.create('testservice:resource', { text: 'toot' });
    Promise.delay(200).then(() => {
      const qName = StellarCore.getServiceInbox('testservice');
      const queue = stellarRequest.transport.queues[qName];
      const job = _.last(queue);
      stellarRequest.inflightRequests[job.data.headers.id](
        { data: { headers: { type: 'response', errorType: 'StellarError' }, body: { message: 'blah', errors: { x: ['shit'] } } } }
      );

      result
        .then(() => fail('fail'))
        .catch(StellarError, (e) => {
          expect(e.message).toEqual('blah');
          expect(e.errors).toEqual({ x: ['shit'] });
          done();
        });
    });
  });
});

describe('no-timeout behaviour on mock request response', () => {
  it('send no-timeout request that responds', (done) => {
    const stellarRequest = getStellarRequest();
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
    const stellarRequest = getStellarRequest();
    const result = stellarRequest.update('alttestservice:resource', { text: 'toot' });
    expect(result.then).toBeInstanceOf(Function);

    result.then(() => {
      fail('fail');
    });

    Promise.delay(1500).then(() => {
      done();
    });
  });

});

describe('middlewares', () => {
  it('use request mw', (done) => {
    const stellarRequest = getStellarRequest();
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
      expect(job.data.headers.id).toEqual('stlr:s:testservice:inbox:1');
      expect(job.data.headers.queueName).toEqual('testservice:resource:get');
      expect(job.data.headers.userId).toEqual(1);
      expect(job.data.headers.respondTo).toEqual(StellarCore.getNodeInbox(stellarRequest.source));
      expect(job.data.headers.source).toEqual(stellarRequest.source);
      expect(job.data.body).toEqual({ text: 'toot' });
      done();
    });
  });

  it('ignore unmatched mw', (done) => {
    const stellarRequest = getStellarRequest();

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
      expect(job.data.headers.id).toEqual('stlr:s:testservice:inbox:1');
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
    const stellarHandler = getStellarHandler('testservice:resource:create');

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
      const qName = 'myQueue';
      const queue = stellarHandler.transport.queues[qName];
      const job = _.last(queue);

      expect(mwRequest.body).toEqual({ text: 'hi' });
      expect(mwResult).toEqual({ text: 'world' });
      done();
    });
  });

  it('reject error from handler mw ', (done) => {
    const stellarHandler = getStellarHandler('testservice:resource:create');

    stellarHandler.use('.*', (jobData, next) => {
      return Promise.reject(new StellarError('boo hoo'));
    });

    stellarHandler.handleMethod('testservice:resource', 'create', (request) => {
      fail('shouldnt be called');
      return { text: 'world' };
    });

    Promise.delay(1000).then(() => {
      const qName = 'myQueue';
      const queue = stellarHandler.transport.queues[qName];
      const job = _.last(queue);

      expect(queue).toHaveLength(1);
      expect(job.data.headers.id).toEqual('myQueue:2');
      expect(job.data.headers).not.toHaveProperty('respondTo');
      expect(job.data.headers).toHaveProperty('source'); // eslint-disable-line
      expect(job.data.headers.errorType).toEqual('StellarError'); // eslint-disable-line
      expect(job.data.body).toEqual({"errors": {"general": ["boo hoo"]},  message: 'boo hoo' });
      done();
    });
  });

  it('throw error from handler mw ', (done) => {
    const stellarHandler = getStellarHandler('testservice:resource:create');

    stellarHandler.use('.*', (jobData, next) => {
      throw new Error('boo hoo');
    });

    stellarHandler.handleMethod('testservice:resource', 'create', (request) => {
      fail('shouldnt be called');
      return { text: 'world' };
    });

    Promise.delay(1000).then(() => {
      const qName = 'myQueue';
      const queue = stellarHandler.transport.queues[qName];
      const job = _.last(queue);

      expect(queue).toHaveLength(1);
      expect(job.data.headers.id).toEqual('myQueue:2');
      expect(job.data.headers).not.toHaveProperty('respondTo');
      expect(job.data.headers).toHaveProperty('source'); // eslint-disable-line
      expect(job.data.headers.errorType).toEqual('Error'); // eslint-disable-line
      expect(job.data.body).toEqual({ message: 'boo hoo' });
      done();
    });
  });

  it('use handler mw in error state', (done) => {
    const stellarHandler = getStellarHandler('testservice:resource:create');

    let mwRequest;
    let mwError;
    stellarHandler.use('.*', (jobData, next) => {
      mwRequest = _.clone(jobData);
      return next().catch((error) => {
        mwError = error.__stellarResponse.body;
        return Promise.reject(error);
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
    const stellarHandler = getStellarHandler('testservice:resource:create');

    let mwRequest;
    let mwError;
    stellarHandler.use('.*', (jobData, next) => {
      mwRequest = _.clone(jobData);
      return next().catch((error) => {
        mwError = error.__stellarResponse.body;
        return Promise.reject(error);
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
  it('if a result is returned and a respondTo is set, send a response with the result', (done) => {
    const stellarHandler = getStellarHandler('testservice:resource:create');

    stellarHandler.handleMethod('testservice:resource', 'create', (request) => {
      expect(request.body.text).toEqual('hi');
      return { text: 'world' };
    });

    Promise.delay(200).then(() => {
      const qName = 'myQueue';
      const queue = stellarHandler.transport.queues[qName];
      const job = _.last(queue);

      expect(queue).toHaveLength(1);
      expect(job.data.headers.id).toEqual('myQueue:2');
      expect(job.data.headers).not.toHaveProperty('respondTo');
      expect(job.data.headers).toHaveProperty('source'); // eslint-disable-line
      expect(job.data.body).toEqual({ text: 'world' });
      done();
    });
  });

  it('if a result is returned and a respondTo is set, send a response with the result array', (done) => {
    const stellarHandler = getStellarHandler('testservice:resource:create', [{text: 'hi'}]);

    stellarHandler.handleMethod('testservice:resource', 'create', (request) => {
      expect(request.body).toEqual([{text: 'hi'}]);
      return Promise.resolve([{ text: 'world' }]);
    });

    Promise.delay(200).then(() => {
      const qName = 'myQueue';
      const queue = stellarHandler.transport.queues[qName];
      const job = _.last(queue);

      expect(queue).toHaveLength(1);
      expect(job.data.headers.id).toEqual('myQueue:2');
      expect(job.data.headers).not.toHaveProperty('respondTo');
      expect(job.data.headers).toHaveProperty('source'); // eslint-disable-line
      expect(job.data.body).toEqual([{ text: 'world' }]);
      done();
    });
  });


  it('if an error is returned and a respondTo is set, send a error response', (done) => {
    const stellarHandler = getStellarHandler('testservice:resource:create');

    stellarHandler.handleMethod('testservice:resource', 'create', (request) => {
      expect(request.body.text).toEqual('hi');
      throw new Error('blah');
    });

    Promise.delay(200).then(() => {
      const qName = 'myQueue';
      const queue = stellarHandler.transport.queues[qName];
      const job = _.last(queue);

      expect(queue).toHaveLength(1);
      expect(job.data.headers.id).toEqual('myQueue:2');
      expect(job.data.headers).not.toHaveProperty('respondTo');
      expect(job.data.headers).toHaveProperty('source'); // eslint-disable-line
      expect(job.data.headers.errorType).toEqual('Error');
      expect(job.data.body).toEqual({ message: 'blah' });
      done();
    });
  });

  it('if validationErrors are returned and a respondTo is set, send a error response', (done) => {
    const stellarHandler = getStellarHandler('testservice:resource:create');

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
      expect(job.data.headers.id).toEqual('myQueue:2');
      expect(job.data.headers).not.toHaveProperty('respondTo');
      expect(job.data.headers).toHaveProperty('source'); // eslint-disable-line
      expect(job.data.headers.errorType).toEqual('StellarError');
      expect(job.data.body.errors).toEqual({ x: ['blah'] });
      done();
    });
  });
});

describe('handler loaders', () => {

  it('_handleLoader 1 element array contains handler no middleware should send a response with the result',
     (done) => {
       const stellarHandler = getStellarHandler('testservice:resource:create');

       stellarHandler._handleLoader('testservice:resource', 'create', [(headers, body) => {
         expect(body.text).toEqual('hi');
         return { text: 'world' };
       }]);

       Promise.delay(200).then(() => {
         const qName = 'myQueue';
         const queue = stellarHandler.transport.queues[qName];
         const job = _.last(queue);

         expect(queue).toHaveLength(1);
         expect(job.data.headers.id).toEqual('myQueue:2');
         expect(job.data.headers).not.toHaveProperty('respondTo');
         expect(job.data.headers).toHaveProperty('source'); // eslint-disable-line
         expect(job.data.body).toEqual({ text: 'world' });
         done();
       });
     });

  it('_handleLoader 2 elements array contains handler and middleware should send a response with the result and call middleware',
     (done) => {
       const stellarHandler = getStellarHandler('testservice:resource:create');


       let middlewareRun = false;
       stellarHandler._handleLoader('testservice:resource', 'create', [(headers, body) => {
         expect(body.text).toEqual('hi');
         return { text: 'world' };
       },(request, next) => {
         middlewareRun = true;
         return next();
       }]);

       Promise.delay(200).then(() => {
         const qName = 'myQueue';
         const queue = stellarHandler.transport.queues[qName];
         const job = _.last(queue);

         expect(queue).toHaveLength(1);
         expect(job.data.headers.id).toEqual('myQueue:2');
         expect(job.data.headers).not.toHaveProperty('respondTo');
         expect(job.data.headers).toHaveProperty('source'); // eslint-disable-line
         expect(job.data.body).toEqual({ text: 'world' });
         expect(middlewareRun).toEqual(true);
         done();
       });
     });

  it('_handleLoader 3 elements array contains handler and 2 middlewares should send a response with the result and call both middlewares',
     (done) => {
       const stellarHandler = getStellarHandler('testservice:resource:create');


       let middleware1Run = false;
       let middleware2Run = false;
       stellarHandler._handleLoader('testservice:resource', 'create', [(headers, body) => {
         expect(body.text).toEqual('hi');
         return { text: 'world' };
       },(request, next) => {
         middleware1Run = true;
         return next();
       }, (request, next) => {
         middleware2Run = true;
         return next();
       }]);

       Promise.delay(200).then(() => {
         const qName = 'myQueue';
         const queue = stellarHandler.transport.queues[qName];
         const job = _.last(queue);

         expect(queue).toHaveLength(1);
         expect(job.data.headers.id).toEqual('myQueue:2');
         expect(job.data.headers).not.toHaveProperty('respondTo');
         expect(job.data.headers).toHaveProperty('source'); // eslint-disable-line
         expect(job.data.body).toEqual({ text: 'world' });
         expect(middleware1Run).toEqual(true);
         expect(middleware2Run).toEqual(true);
         done();
       });
     });

  it('_handleLoader undefined should do nothing', (done) => {
    const stellarHandler = getStellarHandler('testservice:resource:create');

    stellarHandler._handleLoader('testservice:resource', 'create', undefined)
    Promise.delay(200).then(() => {
      const qName = 'myQueue';
      const queue = stellarHandler.transport.queues[qName];
      const job = _.last(queue);

      expect(queue).toEqual(undefined);
      expect(job).toEqual(undefined);
      done();
    });
  });

  it('_handleLoader with handler function should send a response with the result', (done) => {
    const stellarHandler = getStellarHandler('testservice:resource:create');

    stellarHandler._handleLoader('testservice:resource', 'create', (headers, body) => {
      expect(body.text).toEqual('hi');
      return { text: 'world' };
    });

    Promise.delay(200).then(() => {
      const qName = 'myQueue';
      const queue = stellarHandler.transport.queues[qName];
      const job = _.last(queue);

      expect(queue).toHaveLength(1);
      expect(job.data.headers.id).toEqual('myQueue:2');
      expect(job.data.headers).not.toHaveProperty('respondTo');
      expect(job.data.headers).toHaveProperty('source'); // eslint-disable-line
      expect(job.data.body).toEqual({ text: 'world' });
      done();
    });
  });

  it('load one create handler should send a response with the result', (done) => {
    const stellarHandler = getStellarHandler('testservice:resource:create');

    stellarHandler.load('testservice:resource', {
      create: (headers, body) => {
        expect(body.text).toEqual('hi');
        return { text: 'world' };
      }
    });

    Promise.delay(200).then(() => {
      const qName = 'myQueue';
      const queue = stellarHandler.transport.queues[qName];
      const job = _.last(queue);

      expect(queue).toHaveLength(1);
      expect(job.data.headers.id).toEqual('myQueue:2');
      expect(job.data.headers).not.toHaveProperty('respondTo');
      expect(job.data.headers).toHaveProperty('source'); // eslint-disable-line
      expect(job.data.body).toEqual({ text: 'world' });
      done();
    });
  });
})

describe('mock pubsub', () => {

  const channel = 'testpubsub:channel';
  it('fake subscribe handler', (done) => {
    const defaultPubSub = getDefaultPubSub(channel);

    defaultPubSub.subscribe(channel, (message) => {
      expect(message.text).toEqual('hi');
      done();
    });
    
    setTimeout(
      () => defaultPubSub.transport.triggerJob(defaultPubSub.transport.job, defaultPubSub.subscriptionInbox),
      5
    );
  });

  it('send fake publish - should send none', () => {
    const defaultPubSub = getDefaultPubSub(channel);

    defaultPubSub.publish(channel, { text: 'hi' });
    expect(_.keys(defaultPubSub.transport.queues)).toHaveLength(0);
  });

  it('send fake publish - should send one', (done) => {
    const defaultPubSub = getDefaultPubSub(channel);

    defaultPubSub.transport.registerSubscriber(channel, 'POO')
      .then(() => defaultPubSub.publish(channel, { text: 'hi' }))
      .then(() => {
        expect(_.keys(defaultPubSub.transport.queues)).toHaveLength(1);
        expect(_.head(_.keys(defaultPubSub.transport.queues))).toEqual('POO');
        const job = _.head(defaultPubSub.transport.queues['POO']);
        expect(job.data.headers.id).toEqual(`POO:1`);
        done();
      });
  });

  it('send fake publish - should send N', (done) => {
    const defaultPubSub = getDefaultPubSub(channel);
    const allIds = [];

    Promise
      .all(_.range(10)
             .map(i => defaultPubSub.transport.registerSubscriber(channel, `POO.${i}`)))
      .then(() => defaultPubSub.publish(channel, { text: 'hi' }))
      .then(() => {
        expect(_.keys(defaultPubSub.transport.queues)).toHaveLength(10);
        return _.keys(defaultPubSub.transport.queues);
      })
      .each((key) => {
        const job = _.head(defaultPubSub.transport.queues[key]);
        expect(job.data.headers.id).toMatch(new RegExp(`^${key}`));
        expect(allIds).not.toContain(job.data.headers.id);
        allIds.push(job.data.headers.id);
      })
      .then(() => done());
  });
});
