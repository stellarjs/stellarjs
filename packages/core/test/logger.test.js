/**
 * Created by arolave on 25/12/2016.
 */
/* eslint-disable */
import { logger, initLogger } from '../src/logger';

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
        expect(mockLogger.callCounts).toBe(1);
    });

    it('should NOT pass through calls if enableLogging is false', () => {
      initLogger();
      log.info();
      expect(mockLogger.callCounts).toBe(0);
    });
});
