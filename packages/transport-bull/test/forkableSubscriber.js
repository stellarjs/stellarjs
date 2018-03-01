require('babel-register');
const Promise = require('bluebird');
const { subscriber } = require('./helpers');

function forkableSubscriber(source, channel, app) {
  console.log(`forkableSubscriber(${source}, ${channel}, ${app})`);
  const stellarSub = subscriber(source, channel, app);
  return new Promise((resolve) => {
      const subscriber = stellarSub.subscribe(channel, resolve);
      console.log('forkableSubscriber.subscribing')
    })
    .then((result) => {
      console.info(`forkableSubscriber.result ${JSON.stringify(result)}`);
      process.send({ result })
    })
    .catch(err => {
      console.error('forkableSubscriber.error');
      process.send({ err })
    })
    .finally(async () => {
      await stellarSub.transport.reset();
      await Promise.delay(2000);
      process.exit(0);
    });
}
forkableSubscriber(process.argv[2], process.argv[3], process.argv[4]);