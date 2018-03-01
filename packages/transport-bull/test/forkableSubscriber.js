require('babel-register');
const { subscriber } = require('./helpers');

function forkableSubscriber(source, channel, app) {
  try {
    console.log(`forkableSubscriber(${source}, ${channel}, ${app})`);
    const stellarSub = subscriber(source, channel, app);
    console.log('forkableSubscriber.subscribing');
    stellarSub.subscribe(channel, (result) => {
      console.info(`forkableSubscriber.result ${JSON.stringify(result)}`);
      process.send({ result });
    });
    process.on('exit', () => {
      stellarSub.transport.reset();
    });
    process.send('ready');
  } catch (err) {
    console.error(err, 'forkableSubscriber.error');
    process.send({ err })
  }
}
forkableSubscriber(process.argv[2], process.argv[3], process.argv[4]);