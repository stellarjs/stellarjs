/* eslint-disable */
import Redis from 'ioredis';  // eslint-disable-line import/no-extraneous-dependencies
import uuid from 'uuid'
import assign from 'lodash/assign';
import forEach from 'lodash/forEach';
import size from 'lodash/size';

import redisConfig from './config-redis';

let connections = {};
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
    return size(connections);
  }

  newConnection() {
    const client = new Redis(redisConfig);
    assign(client, {id: uuid.v4()});
    client.on('reconnecting', this.log.info);
    client.on('warning', this.log.warn);
    client.on('error', this.log.error);
    client.on('close', () => {
      this.log.info(`@StellarRedis: Closed Connection`);
      delete connections[client.id];
    });
    this.log.info(`@StellarRedis: New Connection`);
    connections[client.id] = client;

    if (connectionInterval == null) {
      // 2 Minutes conneciton counting
      connectionInterval = setInterval(() => this.log.info(`@StellarRedis: Connection Count: ${connectionCount}`), 120000);
    }

    return client;
  }

  closeAll() {
    this.log.info(`@RedisClient.closeAll redis connections ${this.countConnections()}`);
    forEach(connections, (client) => {
      this.log.info(`RedisClient.close ${client.id}`);
      client.disconnect();
    });
    this.log.info(`@RedisClient.closeAll complete`);
  }
}

export default RedisClient;
