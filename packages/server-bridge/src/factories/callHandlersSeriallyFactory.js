import Promise from 'bluebird';
import merge from 'lodash/merge';
import size from 'lodash/size';

export default function callHandlersSeriallyFactory({ log, newSessionHandlers }) {
  function doCallHandlers(index, { session, request }) {
    if (size(newSessionHandlers) === index) {
      return Promise.resolve(session);
    }

    return Promise
          .try(() => newSessionHandlers[index]({ log, session, request }))
          .then(updates => merge(session, updates))
          .then(nextSession => doCallHandlers(index + 1, { session: nextSession, request }))
          .catch((e) => {
            log.error(e, 'error calling handlers');
            throw e;
          });
  }

  return function callHandlersSerially(context) {
    return doCallHandlers(0, context);
  };
}
