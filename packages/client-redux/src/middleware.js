/**
 * Created by moshekabalo on 5/30/17.
 */
import unset from 'lodash/unset';
import isFunction from 'lodash/isFunction';
import isArray from 'lodash/isArray';
import map from 'lodash/map';
import Promise from 'bluebird';
import nanoid from 'nanoid';

import { getActionType } from './getActionType';

export default function (stellarSocket, mwOptions = { transformChannel: undefined }) {
  const stellar = stellarSocket.stellar;

  const stoppersMap = {};

  return (ref) => {
    const { dispatch, getState } = ref;
    return next => (action) => {
      const { payload, resource, method, path, channel, reactiveHandler, Decorator, options } = action;
      const type = getActionType(action);

      const decorate = (response) => {
        if (!Decorator) {
          return response;
        }

        if (isArray(response)) {
          return map(response, res => new Decorator(res));
        }

        return new Decorator(response);
      };

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
          });

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
                    const stopperId = nanoid();
                    stoppersMap[stopperId] = stopper; // eslint-disable-line better-mutation/no-mutation
                    return ({ stopperId, results });
                  });

        return next({ type, payload: { promise: getReactivePromise, data: payload } });
      }

      return next({
        type,
        payload: {
          promise: stellar.request(url, method, payload, options).then(res => decorate(res)),
          data: payload,
        } });
    };
  };
}
