import { configureStellar } from '@stellarjs/core';
import redisTransportFactory from '@stellarjs/transport-redis';

let stellarFactory = null;
export default function connectToMicroservices(log) {
    if (!stellarFactory) {
        stellarFactory = configureStellar({ log, transportFactory: redisTransportFactory });
    }

    return stellarFactory;
}
