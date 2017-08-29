/**
 * Created by moshekabalo on 5/30/17.
 */
import uuid from 'uuid';
import unset from 'lodash/unset';
import isFunction from 'lodash/isFunction';

import getActionType from './getActionType';

export default function (stellarSocket, mwOptions = { transformChannel: undefined }) {
    const stellar = stellarSocket.stellar;

    const stoppersMap = {};

    return (ref) => {
        const { dispatch, getState } = ref;
        return next => (action) => {
            const { payload, resource, method, path, channel, reactiveHandler, options } = action;
            const type = getActionType(action);

            if (!resource && !method) {
                return next(action);
            }

            if (method === 'unsubscribe') {
                const stopper = stoppersMap[payload];
                if (stopper) {
                    stopper();
                }
                unset(stoppersMap, payload);
                return next({ type, payload });
            }

            const url = path ? `${resource}:${path}` : resource;

            if (method === 'subscribe') {
                const cb = (data, publishAction) => dispatch(
                  {
                      type: `${type}_${publishAction}`,
                      payload: data,
                  },
                );

                // in angular no reducers yet so will have to pass reactiveHandler with the action
                const handler = (data, publishAction) => {
                    cb(data, publishAction);
                    if (reactiveHandler) {
                        reactiveHandler(data, publishAction);
                    }
                };

                const finalChannel = isFunction(mwOptions.transformChannel)
                  ? mwOptions.transformChannel(channel, getState())
                  : channel;

                const response = stellar.getReactive(url, finalChannel, payload, handler, options);
                const getReactivePromise = Promise.all([response.onStop, response.results])
                  .then(([stopper, results]) => {
                      const stopperId = uuid();
                      stoppersMap[stopperId] = stopper;
                      return ({ stopperId, results });
                  });

                return next({ type, payload: getReactivePromise });
            }

            return next({ type, payload: stellar.request(url, method, payload, options) });
        };
    };
}
