import { configureStellar } from '@stellarjs/core';
import transportFactory from '@stellarjs/transport-bull';

let stellarFactory = null;
export default function connectToMicroservices(log) {
  if (!stellarFactory) {
    // eslint-disable-next-line better-mutation/no-mutation
    stellarFactory = configureStellar({ log, transportFactory, sourcePrefix: `bridge-` });
  }

  return stellarFactory;
}
