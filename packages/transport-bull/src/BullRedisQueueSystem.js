/**
 * Created by arolave on 07/06/2017.
 */
import Queue from 'bull';
import assign from 'lodash/assign';
import difference from 'lodash/difference';
import get from 'lodash/get';
import map from 'lodash/map';
import size from 'lodash/size';
import split from 'lodash/split';
import Promise from 'bluebird';
import { QueueSystem } from '@stellarjs/abstract-transport-queue';

import RedisClient from './config-redisclient';
import redisConfig from './config-redis';
import { MINUTE_1, DEFAULT_INTERVAL, JOB_TIMEOUT, TWO_WEEKS } from './intervals';

const BULL_OPTIONS = { attempts: 1, removeOnComplete: true, removeOnFail: true, timeout: JOB_TIMEOUT };

class BullRedisQueueSystem extends QueueSystem {
  constructor(log) {
    super(log);
    this.queues = {};
    this.redis = new RedisClient(log);
    this.bullConfig = this.buildBullConfig();
  }

  buildBullConfig() {
    const client = this.redis.newConnection();
    const subscriber = this.redis.newConnection();

    return {
      createClient: (type) => {
        switch (type) {
          case 'client':
            return client;
          case 'subscriber':
            return subscriber;
          default:
            return this.redis.newConnection();
        }
      },
    };
  }

  close() {
    this.log.log('trace', `@${BullRedisQueueSystem.name} queue.close`);
    return Promise
      .all(map(this.queues, (val, key) => this.stopProcessing(key)))
      .then(() => this.redis.closeAll());
  }

  getSubscribers(channel) {
    return this.redis.defaultConnection.zrange(BullRedisQueueSystem._subscribersKey(channel), 0, -1);
  }

  _getQueues() {
    return this.redis.defaultConnection.zrange(BullRedisQueueSystem._queueKey(), 0, -1);
  }

  _doRegistration(key, queueName, interval = DEFAULT_INTERVAL * 2) {
    return this._setTempResource(key, queueName, interval)
      .then(() => setInterval(() => this._setTempResource(key, queueName, interval), interval / 2))
      .then(intervalId => () => {
        clearInterval(intervalId);
        return this._unsetTempResource(key, queueName);
      });
  }

  registerSubscriber(channel, queueName) {
    return this._doRegistration(BullRedisQueueSystem._subscribersKey(channel), queueName);
  }

  _registerQueue(queueName) {
    return this._doRegistration(BullRedisQueueSystem._queueKey(), queueName);
  }

  enqueue(queueName, obj) {
    const opts = assign({ jobId: get(obj, 'headers.id') }, BULL_OPTIONS);
    return this._getQueue(queueName).add(obj, opts);
  }
  
  process(queueName, callback) {
    try {
      const q = this._getQueue(queueName);
      return q.process(callback);
    } catch (e) {
      throw new Error(`${queueName} already has a handler on this node`);
    }
  }

  processGroup(concurrency, queueName, callback) {
    try {
      const q = this._getQueue(queueName);
      return q.process(concurrency, callback);
    } catch (e) {
      throw new Error(`${queueName} already has a handler on this node`);
    }
  }

  stopProcessing(queueName) {
    if (!this.queues[queueName]) {
      return Promise.resolve(true);
    }

    this.log.log('trace', `@${BullRedisQueueSystem.name}: closing queue ${queueName}`);
    return this.queues[queueName]
      .close()
      .then(() => {
        delete this.queues[queueName];
        return true;
      });
  }

  _getQueue(queueName) {
    if (!this.queues[queueName]) {
      this._registerQueue(queueName);
      this.queues[queueName] = new Queue(queueName, this.bullConfig);
    }

    return this.queues[queueName];
  }

  _doCleanQueueResources(resourceKey, queueNames) {
    return Promise.each(queueNames, (queueName => this._unsetTempResource(resourceKey, queueName)));
  }

  _cleanResources(expiryWithin = MINUTE_1) {
    const startTime = Date.now();
    const score = startTime - expiryWithin;

    this.log.info(`@${BullRedisQueueSystem.name}.cleanResources: started for resources expiring ${
      expiryWithin >= 0 ? 'before last' : 'in next'} ${Math.abs(expiryWithin) / MINUTE_1} minutes`);

    return new Promise((resolve) => {
      const stream = this.redis.defaultConnection.scanStream(
        { match: BullRedisQueueSystem._resourceKey('*'), count: 1000 });

      let numCleaned = 0;
      stream.on('data', (resourceKeys) => {
        this.log.info(`@${BullRedisQueueSystem.name}.cleanResources`, { resourceKeys });
        numCleaned += size(resourceKeys); // eslint-disable-line better-mutation/no-mutation

        return Promise // eslint-disable-line lodash/prefer-lodash-method
          .map(resourceKeys, resourceKey => [resourceKey, this.redis.defaultConnection.zrangebyscore(resourceKey, 0, score)])
          .each(([resourceKey, queueNames]) => this._doCleanQueueResources(resourceKey, queueNames));
      });

      stream.on('end', () => {
        this.log.info(`@${BullRedisQueueSystem.name}.resourceClean finished in ${Date.now() - startTime}ms`, { numCleaned });
        resolve(numCleaned);
      });
    });
  }

  _doClean(q, grace, type, numCleaned = 0) {
    return q.clean(grace, type, 5000)
      .delay(100)
      .then((jobs) => {
        if (size(jobs) === 5000) {
          return this._doClean(q, grace, type, numCleaned + 5000);
        }

        const totalCleaned = numCleaned + size(jobs);
        this.log.info(`@${BullRedisQueueSystem.name}.jobClean finished`, { totalCleaned, type, queueName: q.name });
        return [q.name, type, totalCleaned];
      });
  }

  _removeUnusedQueues(inboxStyle) {
    function getQueueForClean(qName) {
      return Promise
          .resolve(new Queue(qName, { redis: redisConfig }))
          .disposer(q => q.close());
    }

    const cleanOldJobs = q => Promise.all(
      map(['completed', 'wait', 'active', 'failed'], jobState => this._doClean(q, TWO_WEEKS, jobState))
    );

    const delId = (qName) => {
      this.redis.defaultConnection.del(`bull:${qName}:id`);
    };

    const emptyQueue = qName => Promise
      .using(getQueueForClean(qName),
             q => Promise.all([q.empty(), cleanOldJobs(q), delId(q.name)])
      )
      .catch(e => this.log.warn(e, `Unable to clean queue`));

    return this._getQueues()
      .then((registeredQueues) => {
        this.log.info(`@${BullRedisQueueSystem.name}._removeUnusedQueues`, { registeredQueues });
        return this._doRemoveUnusedQueues(inboxStyle, (bullQueueNames) => {
          this.log.info(`@${BullRedisQueueSystem.name}._removeUnusedQueues`, { bullQueueNames });
          const unregisteredQueueNames = difference(bullQueueNames, registeredQueues);
          this.log.info(`@${BullRedisQueueSystem.name}._removeUnusedQueues`, { unregisteredQueueNames });
          return Promise.all(map(unregisteredQueueNames, emptyQueue));
        });
      });
  }

  _doRemoveUnusedQueues(inboxStyle, handler, cursor = '0', totalCount = 0) {
    const context = {};
    return this.redis.defaultConnection
      .scan(cursor, 'MATCH', `bull:${inboxStyle}:id`, 'COUNT', '1000')
      .then(results => assign(context, { nextCursor: results[0], rawNames: results[1] }))
      .then(() => map(context.rawNames, n => split(n, ':').slice(1, -1).join(':')))
      .then(queueNames => handler(queueNames))
      .then((cleanedQueues) => {
        const newCount = totalCount + size(cleanedQueues);
        return context.nextCursor === '0'
          ? newCount
          : this._doRemoveUnusedQueues(inboxStyle, handler, context.nextCursor, newCount);
      });
  }

  _setTempResource(key, queueName, interval = DEFAULT_INTERVAL * 2) {
    return this.redis.defaultConnection.zadd(key, Date.now() + interval, queueName);
  }

  _unsetTempResource(key, queueName) {
    return this.redis.defaultConnection.zrem(key, queueName);
  }

  static _subscribersKey(channel) {
    return this._resourceKey(`subscribers:${channel}`);
  }

  static _queueKey() {
    return this._resourceKey(`queues`);
  }

  static _resourceKey(resource) {
    return `stlr:resources:${resource}`;
  }
}

export default BullRedisQueueSystem;
