const instrumentation = {
    startTransaction(txName, session, cb) {
        return cb();
    },
    done(e) {}, // eslint-disable-line no-unused-vars, lodash/prefer-noop
    sessionStarted(elapsed, session) { // eslint-disable-line no-unused-vars
        // newrelic.recordMetric('Custom/Bridge/appConnection', );
        log.info(`Connection init`, { elapsed: `${elapsed}ms`, ...session.logContext });
    },
    sessionFailed(elapsed, session) {}, // eslint-disable-line no-unused-vars, lodash/prefer-noop
    numOfConnectedClients(elapsed, count) {
        console.info(`number of connected clients ${count}`);
    },
};

export default instrumentation
