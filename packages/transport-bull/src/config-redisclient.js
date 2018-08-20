import Redis from 'ioredis';
import nanoid from 'nanoid';
import assign from 'lodash/assign';
import filter from 'lodash/fp/filter';
import flow from 'lodash/fp/flow';
import forEach from 'lodash/fp/forEach';
import size from 'lodash/size';

import redisConfig from './config-redis';

const connections = {};
const connectionCount = 0;
let connectionInterval = null;

class RedisClient {
  constructor(log) {
    this.id = nanoid();
    this.log = log;

    assign(this, {
      defaultConnection: this.newConnection(),
    });
  }

  countConnections() { // eslint-disable-line class-methods-use-this
    return size(connections);
  }

  newConnection() {
    const client = new Redis(redisConfig);
    assign(client, { id: nanoid() });

    const prefix = `@RedisClient(${this.id}).${client.id}`;

    client.on('reconnecting', msg => this.log.log('trace', `${prefix}.reconnecting`, { msg }));
    client.on('warning', msg => this.log.log('trace', `${prefix}.warning`, { msg }));
    client.on('error', e => this.log.log('trace', e, `${prefix}.error`));
    client.on('close', () => {
      this.log.log('trace', `${prefix}: Closed Connection`);
      delete connections[client.id];
    });
    this.log.log('trace', `${prefix}: New Connection`);
    connections[client.id] = client; // eslint-disable-line better-mutation/no-mutation

    if (connectionInterval == null) {
      // 2 Minutes connection counting
      // eslint-disable-next-line better-mutation/no-mutation
      connectionInterval = setInterval(
        () => this.log.log('trace', `@@RedisClient(${this.id}): Connection Count: ${connectionCount}`), 120000);
    }

    return client;
  }

  closeAll() {
    const prefix = `@RedisClient(${this.id})`;
    this.log.log('trace', `${prefix}.closeAll redis connections ${this.countConnections()}`);
    flow([
      filter(client => !client.manuallyClosing),
      forEach((client) => {
        this.log.log('trace', `${prefix}.${client.id}.close ${client.id}`);
        client.quit();
      }),
    ])(connections);
    clearInterval(connectionInterval);
    this.log.log('trace', `${prefix}.closeAll complete`);
  }
}

export default RedisClient;
