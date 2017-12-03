import _ from 'lodash';
import Promise from 'bluebird';
import Core from '../src/core';
import CoreMock from '../mocks/core.mocks';

function expectGetNextId(instance, queueName) {
  return new Promise((resolve, reject) => {
    instance._getNextId(queueName).then((id) => {
      expect(id).toBe(`${queueName}:1`);
      return resolve(id);
    }).catch(error => reject(error));
  });
}

function expectGetMultipleNextIds(instance, done, queueNamesArray) {
  const promiseArray = _.map(queueNamesArray, queueName => expectGetNextId(instance, queueName));
  const combinedPromise = Promise.all(promiseArray);
  combinedPromise.then(done);
}

function expectEnqueue(instance, queueName, payload, messageId) {
  return new Promise((resolve, reject) => {
    instance._enqueue(queueName, payload, messageId).then((result) => {
      expect(result).toBe(result);
      return resolve(result);
    }).catch(error => reject(error));
  });
}

function expectMultipleEnqueues(instance, done, params) {
  const promiseArray = _.map(params, current => expectEnqueue(instance, current.queueName, current.payload, current.messageId));
  const combinedPromise = Promise.all(promiseArray);
  combinedPromise.then(done);
}

function expectProcess(instance, triggerProcess, done, messagesPerQueue, queues) {
  const callbackArray = _.map(queues, queueName => ({
    queueName,
    callback: jest.fn()
  }));
  const processPromiseArray = _.map(callbackArray, current => instance._process(current.queueName, current.callback));
  const combinedProcessPromise = Promise.all(processPromiseArray);
  combinedProcessPromise.then(() => {
    for (let i=0; i < messagesPerQueue; i++) {
      _.forEach(queues, triggerProcess);
    }

    _.forEach(callbackArray, current => {
      expect(current.callback).toHaveBeenCalledTimes(messagesPerQueue);
      expect(current.callback).toHaveBeenLastCalledWith(current.queueName);
    });

    done();
  });
}

function expectStopProcessing(instance, triggerProcess, done, queueName) {
  const callback = jest.fn();
  const processPromise = instance._process(queueName, callback);
  processPromise.then(() => {
    triggerProcess(queueName);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith(queueName);

    instance._stopProcessing(queueName);
    triggerProcess(queueName);
    expect(callback).toHaveBeenCalledTimes(1); // expect not to be called again after stop processing call

    done();
  });
}

describe('Core tests', () => {
  it('Constructed', () => {
    const instance = new Core(console, _.noop, _.noop, _.noop);
    expect(typeof instance).toBe('object');
  });

  it('Failed to generate ID - no idGenerator', () => {
    const instance = new Core(console, _.noop, _.noop, _.noop);

    expect(() => instance._getNextId('abc')).toThrow();
  });

  it('Generates ID', (done) => {
    const coreMock = new CoreMock();
    const instance = new Core(console, coreMock.generateIdMock.bind(coreMock), _.noop, _.noop);
    const queueName = 'generate-one-id';
    expectGetNextId(instance, queueName).then(done);
  });

  it('Generates two IDs', (done) => {
    const coreMock = new CoreMock();
    const instance = new Core(console, coreMock.generateIdMock.bind(coreMock), _.noop, _.noop);
    const queueName = 'generate-two-ids';

    expectGetMultipleNextIds(instance, done, [queueName, queueName]);
  });

  it('Generates multiple IDs on multiple queues', (done) => {
    const coreMock = new CoreMock();
    const instance = new Core(console, coreMock.generateIdMock.bind(coreMock), _.noop, _.noop);
    const queueName1 = 'generate-multiple-ids-1';
    const queueName2 = 'generate-multiple-ids-2';
    const queueName3 = 'generate-multiple-ids-3';
    expectGetMultipleNextIds(instance, done,
      [queueName1, queueName2, queueName3, queueName1, queueName1, queueName2, queueName2, queueName3, queueName3]);
  });

  it('Failed to enqueue - no enqueue function', () => {
    const instance = new Core(console, _.noop, _.noop, _.noop);
    expect(() => {
      instance._enqueue('abc', undefined, 1);
    }).toThrow();
  });

  it('Enqueue single message', (done) => {
    const coreMock = new CoreMock();
    const instance = new Core(console, _.noop, coreMock.enqueueMock.bind(coreMock), _.noop);
    const queueName = 'enqueue-one-message';
    const messageId = 'enqueue-id-1';
    expectEnqueue(instance, queueName, undefined, messageId).then(done);
  });

  it('Enqueue multiple messages', (done) => {
    const coreMock = new CoreMock();
    const instance = new Core(console, _.noop, coreMock.enqueueMock.bind(coreMock), _.noop);
    const queueName = 'enqueue-multiple-messages';
    const payload = undefined;
    const messageIdPrefix = 'enqueue-multiple-id-';
    expectMultipleEnqueues(instance, done, [
      {queueName, payload, messageId: `${messageIdPrefix}1`},
      {queueName, payload, messageId: `${messageIdPrefix}2`},
      {queueName, payload, messageId: `${messageIdPrefix}3`},
    ]);
  });

  it('Enqueue multiple messages on multiple queues', (done) => {
    const coreMock = new CoreMock();
    const instance = new Core(console, _.noop, coreMock.enqueueMock.bind(coreMock), _.noop);
    const queueNamePrefix = 'enqueue-multiple-messages-multiple=queues-';
    const payload = undefined;
    const messageIdPrefix = 'enqueue-multiple-queues-id-';
    expectMultipleEnqueues(instance, done, [
      {queueName: `${queueNamePrefix}1`, payload, messageId: `${messageIdPrefix}1`},
      {queueName: `${queueNamePrefix}2`, payload, messageId: `${messageIdPrefix}2`},
      {queueName: `${queueNamePrefix}3`, payload, messageId: `${messageIdPrefix}3`},
      {queueName: `${queueNamePrefix}1`, payload, messageId: `${messageIdPrefix}1`},
      {queueName: `${queueNamePrefix}1`, payload, messageId: `${messageIdPrefix}2`},
      {queueName: `${queueNamePrefix}2`, payload, messageId: `${messageIdPrefix}3`},
      {queueName: `${queueNamePrefix}2`, payload, messageId: `${messageIdPrefix}1`},
      {queueName: `${queueNamePrefix}3`, payload, messageId: `${messageIdPrefix}2`},
      {queueName: `${queueNamePrefix}3`, payload, messageId: `${messageIdPrefix}3`},
    ]);
  });

  it('Enqueue - fail', (done) => {
    const coreMock = new CoreMock();
    const instance = new Core(console, _.noop, coreMock.enqueueMock.bind(coreMock), _.noop);
    expectEnqueue(instance, undefined, undefined, undefined).catch(done);
  });

  it('Failed to process - no process function', () => {
    const instance = new Core(console, _.noop, _.noop, undefined);
    expect(() => {
      instance._process('abc', _.noop);
    }).toThrow();
  });

  it('Process single message', (done) => {
    const coreMock = new CoreMock();
    const instance = new Core(console, _.noop, _.noop, coreMock.processMock.bind(coreMock));
    expectProcess(instance, coreMock.triggerProcess.bind(coreMock), done, 1, ['process-one-message']);
  });

  it('Process multiple messages', (done) => {
    const coreMock = new CoreMock();
    const instance = new Core(console, _.noop, _.noop, coreMock.processMock.bind(coreMock));
    expectProcess(instance, coreMock.triggerProcess.bind(coreMock), done, 3, ['process-multiple-messages']);
  });

  it('Process multiple messages on multiple queues', (done) => {
    const coreMock = new CoreMock();
    const instance = new Core(console, _.noop, _.noop, coreMock.processMock.bind(coreMock));
    const queueNamePrefix = 'process-multiple-messages-multiple-queues-';
    expectProcess(instance, coreMock.triggerProcess.bind(coreMock), done, 3,
      [`${queueNamePrefix}1`, `${queueNamePrefix}2`, `${queueNamePrefix}3`]);
  });

  it('Stop processing', (done) => {
    const coreMock = new CoreMock();
    const instance = new Core(console, _.noop, _.noop, coreMock.processMock.bind(coreMock), coreMock.stopProcessingMock.bind(coreMock));
    expectStopProcessing(instance, coreMock.triggerProcess.bind(coreMock), done, 'stop-process');
  });
});
