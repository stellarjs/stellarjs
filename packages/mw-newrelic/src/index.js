const newrelic = require('newrelic');
const Promise = require('bluebird');
const _ = require('lodash');

function mw(req, next) {
    if (_.get(req, 'headers.queueName') == null) {
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
                .catch(([err, response]) => {
                    newrelic.noticeError(err);
                    newrelic.endTransaction();
                    reject([err, response]);
                });
        })();
    });
}

module.exports = mw;
