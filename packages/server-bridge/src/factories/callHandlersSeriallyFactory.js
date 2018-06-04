import Promise from 'bluebird';
import size from 'lodash/size';

export default function callHandlersSeriallyFactory({ log }) {
    function doCallHandlers(handlers, index, { session, socket }) {
        if (size(handlers) === index) {
            return session;
        }

        return Promise
            .try(() => handlers[index]({ log, session, socket }))
            .then(nextSession => doCallHandlers(handlers, index + 1, { session: nextSession, socket }))
            .catch((e) => {
                log.error(e, 'error calling handlers');
                throw e;
            });
}

  return function callHandlersSerially(handlers, context) {
    return doCallHandlers(handlers, 0, context);
  };
}
