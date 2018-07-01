import Promise from 'bluebird';
import merge from 'lodash/merge';
import size from 'lodash/size';

export default function callHandlersSeriallyFactory({ log, newSessionHandlers }) {
  function doCallHandlers(index, { session, socket }) {
    if (size(newSessionHandlers) === index) {
      return session;
    }

    return Promise
          .try(() => {
            const updates = newSessionHandlers[index]({ log, session, socket });
            return merge(session, updates);
          })
          .then(nextSession => doCallHandlers(index + 1, { session: nextSession, socket }))
          .catch((e) => {
            log.error(e, 'error calling handlers');
            throw e;
          });
  }

  return function callHandlersSerially(context) {
    return doCallHandlers(0, context);
  };
}
