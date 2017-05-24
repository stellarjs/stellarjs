/**
 * Created by arolave on 06/10/2016.
 */
/* eslint-disable */
import Queue from 'bull';
import _ from 'lodash';
import Promise from 'bluebird';
import RedisExclusiveTask from 'redis-exclusive-task';

import RedisClient from './config-redisclient';
import Enqueuer from './Enqueuer';

const MINUTE_1 = 60 * 1000; // 1 minute
const DEFAULT_INTERVAL = 15 * MINUTE_1; // 15 minutes
const JOB_TIMEOUT = 5 * MINUTE_1;
const TWO_WEEKS = 14 * 24 * 60 * MINUTE_1;

const STELLAR_CONCURRENCY = process.env.STELLAR_CONCURRENCY || 1000;

class RedisTransport {
  constructor(log) {
    this.log = log;
    this.queues = {};
    this.redis = new RedisClient(log);

    if (!this.subscriberCleanerRunning) {
      this.subscriberCleanerRunning = true;

      RedisExclusiveTask.configure([this.redis.newConnection()], log);

      RedisExclusiveTask.run(
        'stlr:subscribers:cleaner',
        () => this._cleanResources(),
        DEFAULT_INTERVAL
      );

      RedisExclusiveTask.run(
        'stlr:queues:remover',
        () => this._removeUnusedQueues('stlr:*:inbox'),
        DEFAULT_INTERVAL
      );
    }
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

  enqueue(queueName, obj) {
    return this._getEnqueuer(queueName).add(obj, { removeOnComplete: true, timeout: JOB_TIMEOUT });
  }

  process(queueName, callback) {
    return this._getQueue(queueName).process(STELLAR_CONCURRENCY, callback);
  }

  flush() {
    _.forEach(_.keys(this.queues), (k) => {
      this.queues[k].close();
      delete this.queues[k];
    });
  }

  _getQueue(queueName) {
    if (!this.queues[queueName]) {
      this._registerQueue(queueName);
      this.queues[queueName] = new Queue(queueName, this.redis.bullConfig);
    }

    return this.queues[queueName];
  }

  _getEnqueuer(queueName) {
    this._setTempResource(RedisTransport._queueKey(), queueName); // sets temporary
    return new Enqueuer(queueName, { client: this.redis.defaultConnection });
  }

  _cleanResources() {
    const startTime = Date.now();
    this.log.info(`@RedisTransport.cleanResources: started`);
    return new Promise((resolve) => {
      const stream = this.redis.defaultConnection.scanStream(
        { match: RedisTransport._resourceKey('*'), count: 1000 });
      let numCleaned = 0;

      stream.on('data', (keys) => {
        const score = Date.now() - MINUTE_1;
        numCleaned += _.size(keys);
        _(keys)
          .map((key => [key, this.redis.defaultConnection.zrangebyscore(key, 0, score)]))
          .forEach(([key, queueNames]) =>
                     Promise.each(queueNames, (queueName => this._unsetTempResource(key, queueName))));
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
        if (_.size(jobs) === 5000) {
          return this._doClean(q, grace, type, numCleaned + 5000);
        }

        const totalCleaned = numCleaned + _.size(jobs);
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
      _.map(['completed', 'wait', 'active', 'failed'], jobState => this._doClean(q, TWO_WEEKS, jobState))
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
      .then(registeredQueues => {
        this.log.info(`@RedisTransport._removeUnusedQueues: registeredQueues=${registeredQueues}`);
        return this._doRemoveUnusedQueues(inboxStyle, (bullQueueNames) => {
          this.log.info(`@RedisTransport._removeUnusedQueues: bullQueueNames=${bullQueueNames}`);
          const unregisteredQueueNames = _.difference(bullQueueNames, registeredQueues);
          this.log.info(`@RedisTransport._removeUnusedQueues: unregisteredQueueNames=${unregisteredQueueNames}`);
          return Promise.all(_.map(unregisteredQueueNames, emptyQueue));
        })
      });
  }

  _doRemoveUnusedQueues(inboxStyle, handler, cursor = '0', totalCount = 0) {
    const context = {};
    return this.redis.defaultConnection
      .scan(cursor, 'MATCH', `bull:${inboxStyle}:id`, 'COUNT', '1000')
      .then(results => _.assign(context, { nextCursor: results[0], rawNames: results[1] }))
      .then(() => _.map(context.rawNames, n => n.split(':').slice(1, -1).join(':')))
      .then(queueNames => handler(queueNames))
      .then((cleanedQueues) => {
        const newCount = totalCount + _.size(cleanedQueues);
        return context.nextCursor === '0'
          ? newCount
          : this._doRemoveUnusedQueues(inboxStyle, handler, context.nextCursor, newCount);
      })
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

  static getInstance(log) {
    if (!this.instance) {
      this.instance = new RedisTransport(log);
    }
    return this.instance;
  }
}

export default RedisTransport.getInstance.bind(RedisTransport);
