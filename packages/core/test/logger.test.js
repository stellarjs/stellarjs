/**
 * Created by arolave on 25/12/2016.
 */
/* eslint-disable */
import { should } from 'chai'; // eslint-disable-line
import chai from 'chai';  // eslint-disable-line
import { logger, initLogger } from '../src/logger';

chai.should();

describe('logger.proxy', () => {
    const mockLogger = {
        callCounts: 0,
        info() {
            this.callCounts += 1;
        },
    };

    function reset() {
        process.env.STELLAR_DEBUG_LOGS = 'false';
        mockLogger.callCounts = 0;
    }

    const log = logger(mockLogger);

    beforeEach(reset);

    it('should pass through function calls if enableLogging is set', () => {
        process.env.STELLAR_DEBUG_LOGS = 'true';
        initLogger();
        log.info();
        mockLogger.callCounts.should.equal(1);
    });

    it('should NOT pass through calls if enableLogging is false', () => {
      initLogger();
      log.info();
      mockLogger.callCounts.should.equal(0);
    });
});
