import Redis from 'ioredis';
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
    
    client.on('reconnecting', (msg) => this.log.info(`${prefix}.reconnecting: ${msg}`));
    client.on('warning', (msg) => this.log.warn(`${prefix}.warning: ${msg}`));
    client.on('error', (msg) => this.log.error(msg, `${prefix}.error: ${msg}`));
    client.on('close', () => {
      this.log.info(`${prefix}: Closed Connection`);
      delete connections[client.id];
    });
    this.log.info(`${prefix}: New Connection`);
    connections[client.id] = client;

    if (connectionInterval == null) {
      // 2 Minutes connection counting
      connectionInterval = setInterval(() => this.log.info(`@@RedisClient(${this.id}): Connection Count: ${connectionCount}`), 120000);
    }

    return client;
  }

  closeAll() {
    const prefix = `@RedisClient(${this.id})`;
    this.log.info(`${prefix}.closeAll redis connections ${this.countConnections()}`);
    forEach(connections, (client) => {
      if (!client.manuallyClosing) {
        this.log.info(`${prefix}.${client.id}.close ${client.id}`);
        client.quit();
      }
    });
    clearInterval(connectionInterval);
    this.log.info(`${prefix}.closeAll complete`);
  }
}

export default RedisClient;
