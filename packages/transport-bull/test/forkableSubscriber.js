require('babel-register');
const Promise = require('bluebird');
const { subscriber } = require('./helpers');

function forkableSubscriber(source, channel, app) {
  const stellarSub = subscriber(source, channel, app);
  return new Promise((resolve) => stellarSub.subscribe(channel, resolve))
    .then((result) => {
      console.info(`result ${JSON.stringify(result)}`);
      process.send({ result })
    })
    .catch(err => {
      console.error('error');
      process.send({ err })
    })
    .finally(async () => {
      await stellarSub.transport.reset();
      await Promise.delay(2000);
      process.exit(0);
    });
}
forkableSubscriber(process.argv[2], process.argv[3], process.argv[4]);