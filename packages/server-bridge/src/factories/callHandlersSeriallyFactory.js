import Promise from 'bluebird';
import size from 'lodash/size';

function doCallHandlers(log, handlers, index, { session, socket }) {
  if (size(handlers) === index) {
    return session;
  }

  return Promise
        .try(() => handlers[index]({ log, session, socket }))
        .then(nextSession => doCallHandlers(log, handlers, index + 1, { session: nextSession, socket }))
        .catch((e) => {
          log.error(e, 'error calling handlers');
          throw e;
        });
}

export default function callHandlersSeriallyFactory({ log }) {
  return function callHandlersSerially(handlers, context) {
    return doCallHandlers(log, handlers, 0, context);
  };
}
