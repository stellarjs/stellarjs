/**
 * Created by arolave on 06/10/2016.
 */
/* eslint-disable */
import RedisTransport from './RedisTransport';
import { configureStellar as coreConfigure } from '@stellarjs/core';
import assign from 'lodash/assign';

let instance;
function transportFactory(log) {
  if (!instance) {
    instance = new RedisTransport(log);
  }
  return instance;
}
transportFactory.type = 'redis';


function configureStellar(options) {
  return coreConfigure(assign(options, { transportFactory }));
}

export { RedisTransport, configureStellar };
