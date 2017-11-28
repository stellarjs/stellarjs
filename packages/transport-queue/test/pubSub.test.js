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
    const channel = 'pub1';
    const groupId = 'pub-group-id-1';
    const stellarMessageId = 'pub1-message';
    const payload = {
      data: {
        headers: {channel},
        body: {messsage: 'message1'}
      }
    };
    const callback = jest.fn();
    expectSubscribeGroup(instance, groupId, channel, callback).then(() =>{
      instance.publish(stellarMessageId, channel, payload).then((messageId) => {
        expect(messageId).toBe(stellarMessageId);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenLastCalledWith(payload.data.body, channel);
        done();
      });
    });
  });

});