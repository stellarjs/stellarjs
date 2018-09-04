function calcNextDelay(maxDelay, delay) {
  const nextDelay = delay * 1.25;
  if (nextDelay > maxDelay) {
    return maxDelay;
  }

  return nextDelay;
}

// A function that keeps trying, "toTry" until it returns true or has
// tried "max" number of times. First retry has a delay of "delay".
// "callback" is called upon success.
export default function configureExponentialBackoff(maxDelay, log) {
  return function exponentialBackoff(toTry, max, delay) {
    log.info(`@client-engine.io.exponentialBackoff`, { max, delay, maxDelay });

    toTry()
      .catch(() => {
        if (max - 1 > 0) {
          setTimeout(() => {
            const nextDelay = calcNextDelay(maxDelay, delay);
            exponentialBackoff(toTry, max - 1, nextDelay);
          }, delay);
        } else {
          log.info('@client-engine.io.exponentialBackoff: we give up');
        }
      });
  };
}