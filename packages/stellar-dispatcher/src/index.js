import uuid from 'uuid';
import _ from 'lodash';

const stoppersMap = {};
let stellar;

export function configure(_stellar) {
    stellar = _stellar; // eslint-disable-line better-mutation/no-mutation
}

export const dispatch = ({ resource, path, method, channel, reactiveHandler, payload, options }) => {
    if (method === 'unsubscribe') {
        const stopper = stoppersMap[payload];
        if (stopper) {
            stopper();
        }
        _.unset(stoppersMap, payload); // eslint-disable-line better-mutation/no-mutating-functions
        return true;
    }

    if (method === 'subscribe') {
        const finalChannel = `op:${_.get(options, 'headers.operationId')}:${channel}`;
        const response = stellar.request.getReactive(path ? `${resource}:${path}` : resource,
            finalChannel,
            payload, reactiveHandler, options);

        return Promise.all([response.onStop, response.results])
            .then(([stopper, results]) => {
                const stopperId = uuid();
                stoppersMap[stopperId] = stopper; // eslint-disable-line better-mutation/no-mutation
                return ({ stopperId, results });
            });
    }

    return stellar.request.request(path ? `${resource}:${path}` : resource, method, payload, options);
};
