import size from 'lodash/size';
import split from 'lodash/split';

const redisUrl = process.env.STELLAR_REDIS_TEST_URL || process.env.STELLAR_REDIS_URL || process.env.REDIS_URL
  || `redis://:@localhost:6379`;
const parts = split(redisUrl, ':');
const passAndhost = split(parts[2], '@');
const redisConfig = {
  host: passAndhost[1],
  port: parseInt(parts[3], 10),
  showFriendlyErrorStack: true,
};

if (process.env.NODE_ENV === 'test') {
  redisConfig.db = 7;
}

if (size(passAndhost[0])) {
  redisConfig.password = passAndhost[0];
}

export default redisConfig;
