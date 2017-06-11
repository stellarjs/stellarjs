/**
 * Created by arolave on 06/10/2016.
 */
import RedisTransport from './RedisTransport';

let instance;
function transportFactory({ log }) {
  if (!instance) {
    instance = new RedisTransport(log);
  }
  return instance;
}
transportFactory.type = 'redis';


export { RedisTransport, transportFactory as default };
