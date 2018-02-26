require('babel-register');
const { subscriber } = require('./helpers');

function forkableSubscriber(source, channel, app) {
  return subscriber(source, channel, app)
    .then((result) => {
      console.info(`result ${JSON.stringify(result)}`);
      process.send({ result })
    })
    .catch(err => {
      console.error('error');
      process.send({ err })
    })
    .finally(() => process.exit(0));
}
forkableSubscriber(process.argv[2], process.argv[3], process.argv[4]);