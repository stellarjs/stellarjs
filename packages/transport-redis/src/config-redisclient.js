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
    this.id = uuid.v4();
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

    const prefix = `@RedisClient(${this.id}).${client.id}`;
    
    client.on('reconnecting', (msg) => this.log.log('trace', `${prefix}.reconnecting`, { msg }));
    client.on('warning', (msg) => this.log.log('trace', `${prefix}.warning`, { msg } ));
    client.on('error', (e) => this.log.log('trace', e, `${prefix}.error`));
    client.on('close', () => {
      this.log.log('trace', `${prefix}: Closed Connection`);
      delete connections[client.id];
    });
    this.log.log('trace', `${prefix}: New Connection`);
    connections[client.id] = client;

    if (connectionInterval == null) {
      // 2 Minutes connection counting
      connectionInterval = setInterval(() => this.log.log('trace', `@@RedisClient(${this.id}): Connection Count: ${connectionCount}`), 120000);
    }

    return client;
  }

  closeAll() {
    const prefix = `@RedisClient(${this.id})`;
    this.log.log('trace', `${prefix}.closeAll redis connections ${this.countConnections()}`);
    forEach(connections, (client) => {
      if (!client.manuallyClosing) {
        this.log.log('trace', `${prefix}.${client.id}.close ${client.id}`);
        client.quit();
      }
    });
    clearInterval(connectionInterval);
    this.log.log('trace', `${prefix}.closeAll complete`);
  }
}

export default RedisClient;
