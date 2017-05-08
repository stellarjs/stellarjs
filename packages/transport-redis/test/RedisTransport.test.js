/**
 * Created by arolave on 01/11/2016.
 */
/* eslint-disable */
const { expect } = require('chai'); // eslint-disable-line
const chai = require('chai');  // eslint-disable-line
const chaiAsPromised = require('chai-as-promised'); // eslint-disable-line
const _ = require('lodash');
const Promise = require('bluebird');
const RedisClient = require('../src/config-redisclient');
const log = console;

// const redisConfig = require('../src/config-redis').default;
const redisTransport = require('../src/redisTransportFactory')(log);

chai.use(chaiAsPromised);
chai.should();

const redisClient = new RedisClient(log).newConnection();

const clearRedis = (done) => {
  if (redisClient.options.db === 7) {
    log.info('Flush redis');
    redisClient.flushdb(done);
  } else {
    done();
  }
};

describe('redis transport subscription', () => {
  beforeEach(clearRedis);

  const channel = 'testChannel';
  const queue = 'testQueue';

  it('should register and unregister', (done) => {
    const context = {};
    redisTransport.registerSubscriber(channel, queue)
      .then(stopper => _.assign(context, { stopper }))
      .then(
        () => redisClient.zrange(redisTransport.constructor._subscribersKey(channel), 0, -1, 'WITHSCORES'))
      .then((subscribers) => {
        _.filter(subscribers, (s, i) => i % 2 === 0).should.deep.equal([queue]);
        _(subscribers).filter((s, i) => i % 2 === 1).forEach(ttl => ttl.should.be.above(Date.now()));
        context.stopper();
      })
      .then(() => [redisClient.zrange(redisTransport.constructor._subscribersKey(channel), 0, -1, 'WITHSCORES')])
      .all()
      .then((subscribers) => {
        subscribers.should.deep.equal([[]]);
        done();
      });
  });
});

describe('redis transport queue resources', () => {
  beforeEach(clearRedis);

  const queue = 'testQueue';

  it('register a queue', (done) => {
    redisTransport.enqueue(queue, { message: 'test' })
      .then(() => redisTransport._getQueues())
      .then(queues => queues.should.deep.equal([queue]))
      .then(
        () => redisClient.zrange(redisTransport.constructor._queueKey(), 0, -1, 'WITHSCORES'))
      .then((queueNames) => {
        _.filter(queueNames, (q, i) => i % 2 === 0).should.deep.equal([queue]);
        _(queueNames).filter((q, i) => i % 2 === 1).forEach(ttl => ttl.should.be.above(Date.now()))
      })
      .then(() => done());
  });
});

describe('removing unused queues', () => {
  beforeEach(clearRedis);
  const queue = 'testQueue:inbox';

  it('_removeUnusedQueues should automatically remove queues that have been deregistered', (done) => {
    const context = {};

    const baseConnections = redisTransport.redis.countConnections();

    redisTransport._registerQueue(queue)
      .then(stopper => _.assign(context, { stopper }))
      .then(() => redisTransport.redis.countConnections().should.equal(baseConnections))
      .then(() => redisTransport.enqueue(queue, { message: 'test' }))
      .then(() => redisTransport._getQueues())
      .then(queues => queues.should.deep.equal([queue]))
      .then(() => redisTransport._removeUnusedQueues('*:inbox'))
      .then(res => res.should.equal(0))
      .then(() => redisTransport.redis.countConnections().should.equal(baseConnections))
      .then(() => redisClient.keys(`bull:${queue}:*`))
      .then(keys => _.size(keys).should.equal(3))
      .delay(50)
      .then(() => context.stopper())
      .then(() => redisTransport._getQueues())
      .then(queues => queues.should.deep.equal([]))
      .then(() => redisClient.keys(`bull:${queue}:*`))
      .then(keys => {
        console.log(keys);
        _.size(keys).should.equal(3)
      })
      .then(() => redisTransport._removeUnusedQueues('*:inbox'))
      .then(res => res.should.equal(1))
      .then(() => redisClient.keys(`bull:*`))
      .then(keys => {
        console.log(keys);
        _.size(keys).should.equal(0);
      })
      .then(() => redisTransport.redis.countConnections().should.equal(baseConnections))
      .then(() => done());
  });
});

describe('redis transport resources invalidation', () => {
  beforeEach(clearRedis);

  const channel = 'testChannel';
  const queue = 'testQueue';

  it('cleanup should automatically remove resources', (done) => {
    console.log(Date.now());
    const score = Date.now() - (20 * 60 * 1000);
    console.log(score);
    Promise.all([redisClient.zadd(redisTransport.constructor._subscribersKey(channel), score, queue),
                 redisClient.zadd(redisTransport.constructor._queueKey(), score, queue)])
      .then(() => redisTransport.getSubscribers(channel))
      .then(subscribers => subscribers.should.deep.equal([queue]))
      .then(() => redisTransport._getQueues())
      .then(queues => queues.should.deep.equal([queue]))
      .then(() => redisTransport._cleanResources())
      .delay(500)
      .then(() => redisTransport.getSubscribers(channel))
      .then(subscribers => subscribers.should.deep.equal([]))
      .then(() => redisTransport._getQueues())
      .then(queues => queues.should.deep.equal([]))
      .then(() => done());
  });
});

