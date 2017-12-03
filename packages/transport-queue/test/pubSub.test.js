import _ from 'lodash';
import Promise from 'bluebird';
import PubSub from '../src/pubSub';
import CoreMock from '../mocks/core.mocks';
import PubSubMock from '../mocks/pubSub.mocks';

function createInstance(getSubscribers, registerSubscriber) {
  const coreMock = new CoreMock();
  return new PubSub(console,
    coreMock.generateIdMock.bind(coreMock),
    coreMock.enqueueMock.bind(coreMock),
    coreMock.processMock.bind(coreMock),
    coreMock.stopProcessingMock.bind(coreMock),
    getSubscribers,
    registerSubscriber
  );
}

function createInstanceFullMocks(){
  const pubSubMock = new PubSubMock();
  return createInstance(pubSubMock.getSubscribersMock.bind(pubSubMock), pubSubMock.registerSubscriberMock.bind(pubSubMock));
}

function expectSubscribeGroup(instance, groupId, channel, messageHandler) {
  const handler = _.isNil(messageHandler) ? _.noop : messageHandler;
  return new Promise((resolve, reject) => {
    instance.subscribeGroup(groupId, channel, handler).then(unsubscribe => {
      expect(typeof unsubscribe).toBe('function');
      return resolve(unsubscribe);
    }).catch(error => reject(error));
  });
}

function expectSubscribeGroupMultiple(instance, done, params) {
  const promiseArray = _.map(params, current => expectSubscribeGroup(instance, current.groupId, current.channel));
  const combinedPromise = Promise.all(promiseArray);
  combinedPromise.then(done);
}

function expectPublish(instance, stellarMessageId, channel, body) {
  const payload = { data: { body } };

  return new Promise((resolve, reject) => {
    instance.publish(stellarMessageId, channel, payload).then(messageId => {
      expect(messageId).toBe(stellarMessageId);
      return resolve(messageId);
    }).catch(error => reject(error));
  });
}

function expectPublishMultiple(instance, done, messagesPerChannel, channels) {
  const groupIdPrefix = 'group-id-';
  const stellarMessageIdPrefix = 'message-id-';
  const bodyMessagePrefix = 'body-message-';

  const channelsArray = _.map(channels, channel => ({
    channel,
    groupId: `${groupIdPrefix}${channel}`,
    callback: jest.fn()
  }));

  const buildParam = (channel, id) => ({
    channel,
    stellarMessageId: `${stellarMessageIdPrefix}${channel}-${id}`,
    body: { messsage: `${bodyMessagePrefix}${channel}-${id}` },
    callback: _.find(channelsArray, current => (current.channel === channel)).callback
  });

  const subscribePromiseArray = _.map(channelsArray, current =>
    expectSubscribeGroup(instance, current.groupId, current.channel, current.callback));
  const combinedSubscribePromise = Promise.all(subscribePromiseArray);

  let expectedResults = [];

  combinedSubscribePromise.then(() => {
    let publishPromiseArray = [];
    for (let i=1; i <= messagesPerChannel; i++) {
      const currentPublishPromiseArray = _.map(channels, (channel)=> {
        const params = buildParam(channel, i);
        expectedResults.push(params);
        return expectPublish(instance, params.stellarMessageId, params.channel, params.body);
      });
      publishPromiseArray = _.concat(publishPromiseArray, currentPublishPromiseArray);
    }

    const combinedPublishPromise = Promise.all(publishPromiseArray);
    combinedPublishPromise.then(()=> {
      _.forEach(channelsArray, current => {
        // console.log(`~~~~~~~~~~~~~~~~~~~~~~~ ${current.channel}`);
        // if (channels[1] === current.channel) return;
        expect(current.callback).toHaveBeenCalledTimes(messagesPerChannel);
      });

      _.forEach(expectedResults, current => {
        // console.log(`~~~~~~~~~~~~~~~~~~~~~~~2 ${current.channel}`);
        // if (channels[1] === current.channel) return;
        expect(current.callback).toHaveBeenCalledWith(current.body, current.channel);
      });
      done();
    });
  });
}

describe('PubSub tests', () => {
  it('Constructed', () => {
    const instance = createInstance(_.noop, _.noop);
    expect(typeof instance).toBe('object');
  });

  it('Failed to subscribe on group - no registerSubscription', () => {
    const instance = createInstance(_.noop, _.noop);
    expect(() => {
      instance.subscribeGroup('sub-fail-group', 'sub-fail', _.noop);
    }).toThrow();
  });

  it('Subscribe on one channel with one group', (done) => {
    const instance = createInstanceFullMocks();
    const channelName = 'sub-group';
    const groupId = 'sub-group-id';
    expectSubscribeGroup(instance, groupId, channelName).then(done);
  });

  it('Subscribe on multiple channels with one group', (done) => {
    const instance = createInstanceFullMocks();
    const channelNamePrefix = 'sub-multiple-channels-one-group-';
    const groupId = 'sub-group-id-1';
    expectSubscribeGroupMultiple(instance, done, [
      { groupId, channel: `${channelNamePrefix}1`},
      { groupId, channel: `${channelNamePrefix}2`},
      { groupId, channel: `${channelNamePrefix}3`},
    ]);
  });

  it('Failed to publish - no getSubscribers', () => {
    const instance = createInstance(undefined, _.noop);
    expect(() => {
      instance.publish(1, 'pub-fail', undefined);
    }).toThrow();
  });

  it('Publish single message', (done) => {
    const instance = createInstanceFullMocks();
    const channel = 'pub';
    expectPublishMultiple(instance, done, 1, [channel]);
  });

  it('Publish multiple messages on one channel', (done) => {
    const instance = createInstanceFullMocks();
    const channel = 'pub-multiple-one-channel';
    expectPublishMultiple(instance, done, 4, [channel]);
  });

  it.only('Publish multiple messages on multiple channels', (done) => {
    const instance = createInstanceFullMocks();
    const channelPrefix = 'pub-multiple-channels-';
    expectPublishMultiple(instance, done, 1, [
      `${channelPrefix}1`,
      `${channelPrefix}2`,
      // `${channelPrefix}3`,
    ]);
  });
});