const instrumentation = {
    startTransaction(txName, session, cb) {
        cb();
    },
    done(e) {}, // eslint-disable-line no-unused-vars, lodash/prefer-noop
    sessionStarted(elapsed, session) { // eslint-disable-line no-unused-vars
        // newrelic.recordMetric('Custom/Bridge/appConnection', );
        console.info(`${session.logPrefix} Connection init in ${elapsed}ms`);
    },
    sessionFailed(elapsed, session) {}, // eslint-disable-line no-unused-vars, lodash/prefer-noop
    numOfConnectedClients(elapsed, count) {
        console.info(`number of connected clients ${count}`);
    },
};

export default instrumentation
