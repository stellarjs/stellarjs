import assign from 'lodash/assign';
import pick from 'lodash/pick';

function requestResponseLogBody(req, res) {
  return { req, res: { body: res.body } };
}

function isRequest(req) {
  return req.headers.type === 'request' || req.headers.type === 'reactive';
}

export default function mwLogSummary(req, next, options, log) {
  const prefix = `stellar ${req.headers.type}`;
  let start = null;

  if (!isRequest(req)) {
    log.info(prefix, { req });
  } else {
    start = Date.now();
  }

  return next()
    .then((res) => {
      if (isRequest(req)) {
        log.info(`${prefix} ${Date.now() - start}ms`, requestResponseLogBody(req, res));
      }
      return res;
    })
    .catch((err) => {
      const res = err.__stellarResponse;
      if (isRequest(req)) {
        log.error(
            `${prefix} ${Date.now() - start}ms`,
            assign(pick(res.headers, ['errorType', 'errorSource']), requestResponseLogBody(req, res)));
      } else {
        log.error(prefix, err);
      }
      throw err;
    });
}
