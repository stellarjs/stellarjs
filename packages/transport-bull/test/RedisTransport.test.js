/**
 * Created by arolave on 01/11/2016.
 */
/* eslint-disable */
import _ from 'lodash';
import Promise from 'bluebird';
import { BullRedisQueueSystem } from '../src/index';

const log = console;
let redisTransport;
let connection;

beforeAll(() => {
  redisTransport = new BullRedisQueueSystem(log);
  connection = redisTransport.redis.defaultConnection;
});

afterAll((done) => {
  redisTransport.close()
    .then(() => done());
});

const clearRedis = (done) => {
  if (connection.options.db === 7) {
    log.info('Flush redis');
    connection.flushdb(done);
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
        () => connection.zrange(redisTransport.constructor._subscribersKey(channel), 0, -1, 'WITHSCORES'))
      .then((subscribers) => {
        expect(_.filter(subscribers, (s, i) => i % 2 === 0)).toEqual([queue]);
        _(subscribers).filter((s, i) => i % 2 === 1).forEach(ttl => expect(parseInt(ttl)).toBeGreaterThan(Date.now()));
        context.stopper();
      })
      .then(() => [connection.zrange(redisTransport.constructor._subscribersKey(channel), 0, -1, 'WITHSCORES')])
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
      //   () => connection.zrange(redisTransport.constructor._queueKey(), 0, -1, 'WITHSCORES'))
      // .then((queueNames) => {
      //   _.filter(queueNames, (q, i) => i % 2 === 0).should.deep.equal([queue]);
      //   _(queueNames).filter((q, i) => i % 2 === 1).forEach(ttl => ttl.should.be.above(Date.now()))
      // })
      // .then(() => done());
  });
});

describe('removing unused queues', () => {
  beforeEach(clearRedis);
  const queue = 'testQueue:req';

  it('_removeUnusedQueues should automatically remove queues that have been deregistered', (done) => {
    const context = {};

    const baseConnections = redisTransport.redis.countConnections();

    redisTransport._registerQueue(queue)
      .then(stopper => _.assign(context, { stopper }))
      .then(() => expect(redisTransport.redis.countConnections()).toBe(baseConnections))
      .then(() => redisTransport.enqueue(queue, { message: 'test' }))
      .then(() => redisTransport._getQueues())
      .then(queues => expect(queues).toEqual([queue]))
      .then(() => redisTransport._removeUnusedQueues('*:req'))
      .then(res => expect(res).toBe(0))
      .then(() => expect(redisTransport.redis.countConnections()).toBe(baseConnections))
      .then(() => connection.keys(`bull:${queue}:*`))
      .then(keys => expect(_.size(keys)).toBe(3))
      .delay(50)
      .then(() => context.stopper())
      .then(() => redisTransport._getQueues())
      .then(queues => expect(queues).toEqual([]))
      .then(() => connection.keys(`bull:${queue}:*`))
      .then(keys => {
        console.log(keys);
        expect(_.size(keys)).toBe(3)
      })
      .then(() => redisTransport._removeUnusedQueues('*:req'))
      .then(res => expect(res).toBe(1))
      .then(() => connection.keys(`bull:*`))
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
    Promise.all([connection.zadd(redisTransport.constructor._subscribersKey(channel), score, queue),
                 connection.zadd(redisTransport.constructor._queueKey(), score, queue)])
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

