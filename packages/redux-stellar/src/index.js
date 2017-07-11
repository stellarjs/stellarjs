/**
 * Created by moshekabalo on 5/30/17.
 */
import uuid from 'uuid';
import _ from 'lodash';

export default function (stellarSocket, mwOptions = { transformChannel: undefined }) {
    const stellar = stellarSocket.stellar;

    const stoppersMap = {};

    return (ref) => {
        const { dispatch, getState } = ref;
        return next => (action) => {
            const { type, payload, resource, method, path, channel, reactiveHandler, options } = action;

            if (!resource && !method) {
                return next(action);
            }

            if (method === 'unsubscribe') {
                const stopper = stoppersMap[payload];
                if (stopper) {
                    stopper();
                }
                _.unset(stoppersMap, payload);
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

                const finalChannel = _.isFunction(mwOptions.transformChannel)
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
