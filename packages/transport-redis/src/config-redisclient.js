/* eslint-disable */
const Redis = require('ioredis');  // eslint-disable-line import/no-extraneous-dependencies

const redisConfig = require('./config-redis');

let connectionCount = 0;
let connectionInterval = null;

class RedisClient {
  constructor(log) {
    this.log = log;
    Object.assign(this, {
      defaultConnection: this.newConnection(),
      bullConfig: { redis: { opts: { createClient: this.newConnection.bind(this) } } },
    });
  }

  countConnections() {
    return connectionCount;
  }

  newConnection() {
    const client = new Redis(redisConfig);
    client.on('reconnecting', this.log.info);
    client.on('warning', this.log.warn);
    client.on('error', this.log.error);
    client.on('close', () => {
      this.log.info(`@StellarRedis: Closed Connection`);
      connectionCount -= 1;
    });
    this.log.info(`@StellarRedis: New Connection`);
    connectionCount += 1;

    if (connectionInterval == null) {
      connectionInterval =
        setInterval(() => this.log.info(`@StellarRedis: Connection Count: ${connectionCount}`), 120000); // 2 Minutes
    }

    return client;
  }
}

module.exports = RedisClient;
