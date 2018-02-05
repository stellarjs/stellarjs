const log = console;

let resourceCount = 0;
function getResourceName() {
  resourceCount += 1;
  return `testservice:resource_${resourceCount}`;
}

let channelCount = 0;
function getChannelName() {
  resourceCount += 1;
  return `test:channel_${resourceCount}`;
}

export { log, getResourceName, getChannelName };
