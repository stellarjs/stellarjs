import newrelic from 'newrelic';
import Promise from 'bluebird';
import get from 'lodash/get';
import omit from 'lodash/omit';

export default function (req, next) {
  if (get(req, 'headers.queueName') == null) {
    return next();
  }

  return new Promise((resolve, reject) => {
    newrelic.createWebTransaction(req.headers.queueName, () => {
      newrelic.addCustomParameters(req.data);
      return next()
                .then((result) => {
                  newrelic.endTransaction();
                  resolve(result);
                })
                .catch((err) => {
                  newrelic.noticeError(omit(err, '__stellarResponse'));
                  newrelic.endTransaction();
                  reject(err);
                });
    })();
  });
}
