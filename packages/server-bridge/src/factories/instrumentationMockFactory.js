function instrumentationMockFactory({ log }) {
  return {
    startTransaction(txName, session, cb) {
      cb();
    },
    done(e) {}, // eslint-disable-line no-unused-vars, lodash/prefer-noop
    sessionStarted(elapsed, session) { // eslint-disable-line no-unused-vars
          // newrelic.recordMetric('Custom/Bridge/appConnection', );
      log.info(`Connection init`, { elapsed: `${elapsed}ms`, ...session.logPrefix });
    },
    sessionFailed(elapsed, session) {}, // eslint-disable-line no-unused-vars, lodash/prefer-noop
      // will be called on close and open with the current engine io status
    numOfConnectedClients(elapsed, count) {
      log.info(`number of connected clients ${count}`);
    },
  };
}

export default instrumentationMockFactory;
