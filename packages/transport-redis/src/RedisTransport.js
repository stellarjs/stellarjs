/**
 * Created by arolave on 07/06/2017.
 */
import Queue from 'bull';
import assign from 'lodash/assign';
import difference from 'lodash/difference';
import map from 'lodash/map';
import size from 'lodash/size';
import split from 'lodash/split';
import Promise from 'bluebird';

import RedisClient from './config-redisclient';
import Enqueuer from './Enqueuer';
import { MINUTE_1, DEFAULT_INTERVAL, JOB_TIMEOUT, TWO_WEEKS } from './intervals';

const STELLAR_CONCURRENCY = process.env.STELLAR_CONCURRENCY || 1000;

class RedisTransport {
  constructor(log) {
    this.log = log;
    this.queues = {};
    this.redis = new RedisClient(log);
    this.bullConfig = assign({}, this.redis.bullConfig);
  }

  close() {
    this.log.info(`@RedisTransport queue.close`);
    return Promise
      .all(map(this.queues, (val, key) => this.stopProcessing(key)))
      .then(() => this.redis.closeAll());
  }

  getSubscribers(channel) {
    return this.redis.defaultConnection.zrange(RedisTransport._subscribersKey(channel), 0, -1);
  }

  _getQueues() {
    return this.redis.defaultConnection.zrange(RedisTransport._queueKey(), 0, -1);
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
    return this._doRegistration(RedisTransport._subscribersKey(channel), queueName);
  }

  _registerQueue(queueName) {
    return this._doRegistration(RedisTransport._queueKey(), queueName);
  }

  generateId(queueName) {
    return this.redis.defaultConnection.incr(`stlr:${queueName}:id`);
  }

  enqueue(queueName, obj) {
    return this._getEnqueuer(queueName).add(obj, { removeOnComplete: true, timeout: JOB_TIMEOUT });
  }

  process(queueName, callback) {
    try {
      return this._getQueue(queueName).process(STELLAR_CONCURRENCY, callback);
    } catch (e) {
      throw new Error(`${queueName} already has a handler on this node`);
    }
  }

  stopProcessing(queueName) {
    if (!this.queues[queueName]) {
      return Promise.resolve(true);
    }

    this.log.info(`@RedisTransport: closing queue ${queueName}`);
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

  _getEnqueuer(queueName) {
    this._setTempResource(RedisTransport._queueKey(), queueName); // sets temporary
    return new Enqueuer(queueName, { client: this.redis.defaultConnection });
  }

  _doCleanQueueResources(resourceKey, queueNames) {
    return Promise.each(queueNames, (queueName => this._unsetTempResource(resourceKey, queueName)));
  }

  _cleanResources(expiryWithin = MINUTE_1) {
    const startTime = Date.now();
    const score = startTime - expiryWithin;

    this.log.info(`@RedisTransport.cleanResources: started for resources expiring ${
      expiryWithin >= 0 ? 'before last' : 'in next'} ${Math.abs(expiryWithin) / MINUTE_1} minutes`);

    return new Promise((resolve) => {
      const stream = this.redis.defaultConnection.scanStream(
        { match: RedisTransport._resourceKey('*'), count: 1000 });

      let numCleaned = 0;
      stream.on('data', (resourceKeys) => {
        this.log.info(`@RedisTransport.cleanResources: keys=${resourceKeys}`);
        numCleaned += size(resourceKeys); // eslint-disable-line better-mutation/no-mutation

        return Promise // eslint-disable-line lodash/prefer-lodash-method
          .map(resourceKeys, resourceKey => [resourceKey, this.redis.defaultConnection.zrangebyscore(resourceKey, 0, score)])
          .each(([resourceKey, queueNames]) => this._doCleanQueueResources(resourceKey, queueNames));
      });

      stream.on('end', () => {
        this.log.info(`@RedisTransport.cleanResources: ${numCleaned} cleaned in ${Date.now() - startTime}ms`);
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
        this.log.info(`@RedisTransport._doClean Cleaned ${totalCleaned} ${type} jobs out of ${q.name}`);
        return [q.name, type, totalCleaned];
      });
  }

  _getQueueForClean(qName) {
    return Promise
      .resolve(new Queue(qName, this.redis.bullConfig))
      .disposer(q => q.close());
  }

  _removeUnusedQueues(inboxStyle) {
    const cleanOldJobs = q => Promise.all(
      map(['completed', 'wait', 'active', 'failed'], jobState => this._doClean(q, TWO_WEEKS, jobState))
    );

    const delId = (qName) => {
      this.redis.defaultConnection.del(`bull:${qName}:id`);
    };

    const emptyQueue = qName => Promise
      .using(this._getQueueForClean(qName),
             q => Promise.all(
               [q.empty(), cleanOldJobs(q), delId(q.name)]
             )
      )
      .catch(e => this.log.warn(`Unable to clean queue`, e));

    return this._getQueues()
      .then((registeredQueues) => {
        this.log.info(`@RedisTransport._removeUnusedQueues: registeredQueues=${registeredQueues}`);
        return this._doRemoveUnusedQueues(inboxStyle, (bullQueueNames) => {
          this.log.info(`@RedisTransport._removeUnusedQueues: bullQueueNames=${bullQueueNames}`);
          const unregisteredQueueNames = difference(bullQueueNames, registeredQueues);
          this.log.info(`@RedisTransport._removeUnusedQueues: unregisteredQueueNames=${unregisteredQueueNames}`);
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

export default RedisTransport;
