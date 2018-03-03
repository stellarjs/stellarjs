import _ from 'lodash';

const log = console;

let resourceCount = 0;
function getResourceName(app) {
  resourceCount += 1;
  return `${app}:resource_${resourceCount}`;
}

let channelCount = 0;
function getChannelName() {
  resourceCount += 1;
  return `test:channel_${resourceCount}`;
}

let transports;
function transportGenerator(apps, factory) {
  transports = _.mapValues(apps, (sources, app) =>
    _(sources)
      .map((source) => [ source, factory({ log, source, app, requestTimeout: 1000 }) ])
      .fromPairs()
      .value()
  );

  return transports;
}

async function closeTransport(onClose) {
  await Promise.all(
    _.flatMap(transports, (sources) =>
      _.map(sources, (transport) => transport.reset())));

  return onClose(transports);
}

export { log, getResourceName, getChannelName, transportGenerator, closeTransport };
