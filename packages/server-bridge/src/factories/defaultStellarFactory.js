import { configureStellar } from '@stellarjs/core';
import transportFactory from '@stellarjs/transport-bull';

const stellarFactories = {};
export default function connectToMicroservices({ log, sourcePrefix = `bridge-` }) {
  if (!stellarFactories[sourcePrefix]) {
    // eslint-disable-next-line better-mutation/no-mutation
    stellarFactories[sourcePrefix] = configureStellar({ log, transportFactory, sourcePrefix });
  }

  return stellarFactories[sourcePrefix];
}
