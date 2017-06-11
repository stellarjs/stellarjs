/**
 * Created by arolave on 01/11/2016.
 */
/* eslint-disable */
import _ from 'lodash';
import Promise from 'bluebird';
import RedisClient from '../src/config-redisclient';
import { RedisTransport } from '../src/index';

const log = console;
let redisClient;
let redisTransport;
let redisClientFactory;

beforeAll(() => {
  redisTransport = new RedisTransport(log);
  redisClientFactory = new RedisClient(log);
  redisClient = redisClientFactory.newConnection()
});

afterAll(() => {
  // redisClientFactory.closeAll();
});

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
        expect(_.filter(subscribers, (s, i) => i % 2 === 0)).toEqual([queue]);
        _(subscribers).filter((s, i) => i % 2 === 1).forEach(ttl => expect(parseInt(ttl)).toBeGreaterThan(Date.now()));
        context.stopper();
      })
      .then(() => [redisClient.zrange(redisTransport.constructor._subscribersKey(channel), 0, -1, 'WITHSCORES')])
      .all()
      .then((subscribers) => {
        expect(subscribers).toEqual([[]]);
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
      .then(queues => {
        expect(queues).toEqual([queue]);
        done();
      })
      // .then(
      //   () => redisClient.zrange(redisTransport.constructor._queueKey(), 0, -1, 'WITHSCORES'))
      // .then((queueNames) => {
      //   _.filter(queueNames, (q, i) => i % 2 === 0).should.deep.equal([queue]);
      //   _(queueNames).filter((q, i) => i % 2 === 1).forEach(ttl => ttl.should.be.above(Date.now()))
      // })
      // .then(() => done());
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
      .then(() => expect(redisTransport.redis.countConnections()).toBe(baseConnections))
      .then(() => redisTransport.enqueue(queue, { message: 'test' }))
      .then(() => redisTransport._getQueues())
      .then(queues => expect(queues).toEqual([queue]))
      .then(() => redisTransport._removeUnusedQueues('*:inbox'))
      .then(res => expect(res).toBe(0))
      .then(() => expect(redisTransport.redis.countConnections()).toBe(baseConnections))
      .then(() => redisClient.keys(`bull:${queue}:*`))
      .then(keys => expect(_.size(keys)).toBe(3))
      .delay(50)
      .then(() => context.stopper())
      .then(() => redisTransport._getQueues())
      .then(queues => expect(queues).toEqual([]))
      .then(() => redisClient.keys(`bull:${queue}:*`))
      .then(keys => {
        console.log(keys);
        expect(_.size(keys)).toBe(3)
      })
      .then(() => redisTransport._removeUnusedQueues('*:inbox'))
      .then(res => expect(res).toBe(1))
      .then(() => redisClient.keys(`bull:*`))
      .then(keys => {
        console.log(keys);
        expect(_.size(keys)).toBe(0);
      })
      .then(() => expect(redisTransport.redis.countConnections()).toBe(baseConnections))
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
      .then(subscribers => expect(subscribers).toEqual([queue]))
      .then(() => redisTransport._getQueues())
      .then(queues => expect(queues).toEqual([queue]))
      .then(() => redisTransport._cleanResources())
      .delay(500)
      .then(() => redisTransport.getSubscribers(channel))
      .then(subscribers => expect(subscribers).toEqual([]))
      .then(() => redisTransport._getQueues())
      .then(queues => expect(queues).toEqual([]))
      .then(() => done());
  });
});

