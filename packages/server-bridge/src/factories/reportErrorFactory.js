import assign from 'lodash/assign';
import isObject from 'lodash/isObject';
import forEach from 'lodash/forEach';
import get from 'lodash/get';
import last from 'lodash/last';
import pick from 'lodash/pick';
import split from 'lodash/split';

export default function reportErrorFactory({ log, errorHandlers = [] }) {
  return function reportError(e, session, command) {
    log.error(e, 'Error Reported');

    const sessionVars = pick(
            session,
            ['authenticatedUserId', 'requestUserId', 'sessionId', 'operationId', 'domain', 'ip']
        );

    if (isObject(command)) {
      const bridgeRequestType = get(command, 'data.headers.type', 'noType');
      const queueName = get(command, 'data.headers.queueName');
      const channel = get(command, 'data.headers.channel');
      const path = `${bridgeRequestType}/${queueName || channel || ''}`;
      const method = queueName ? last(split(queueName, ':')) : undefined;
      const dataHeaders = get(command, 'data.headers');

      forEach(errorHandlers, errorHandler => errorHandler({
        headers: assign({}, sessionVars, dataHeaders),
        method,
        route: { path },
        body: get(command, 'data.body', JSON.stringify(command)),
      }));
    } else {
      forEach(errorHandlers, errorHandler => errorHandler({ headers: sessionVars, body: command }));
    }
  };
}
