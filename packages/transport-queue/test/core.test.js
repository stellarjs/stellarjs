import _ from 'lodash';
import Core from '../src/core';
import { generateIdMock, enqueueMock, processMock, triggerProcess, clearProcessCallbacks } from '../mocks/core.mocks';

function expectGetNextId(instance, queueName) {
  expect(instance._getNextId(queueName)).resolves.toBe(`${queueName}:1`);
}

describe('Core tests', () => {
  it('constructed', () => {
    const instance = new Core(console, _.noop, _.noop, _.noop);
    expect(typeof instance).toBe('object');
  });

  it('Failed to generate ID when no id generator set', () => {
    const instance = new Core(console, _.noop, _.noop, _.noop);
    expect(() => {
      instance._getNextId('abc');
    }).toThrow();
  });

  it('Generates ID', () => {
    const instance = new Core(console, generateIdMock, _.noop, _.noop);
    const queueName = 'abc';
    expectGetNextId(instance, queueName);
  });

  it('Generates two IDs', () => {
    const instance = new Core(console, generateIdMock, _.noop, _.noop);
    const queueName = 'abc';
    expectGetNextId(instance, queueName);
    expectGetNextId(instance, queueName);
  });

  it('Generates multiple IDs on multiple queues', () => {
    const instance = new Core(console, generateIdMock, _.noop, _.noop);
    const queueName1 = 'abc';
    const queueName2 = 'def';
    const queueName3 = 'ghi';
    expectGetNextId(instance, queueName1);
    expectGetNextId(instance, queueName2);
    expectGetNextId(instance, queueName3);
    expectGetNextId(instance, queueName1);
    expectGetNextId(instance, queueName1);
    expectGetNextId(instance, queueName2);
    expectGetNextId(instance, queueName2);
    expectGetNextId(instance, queueName3);
    expectGetNextId(instance, queueName3);
  });

  it('Enqueue', () => {
    const instance = new Core(console, _.noop, enqueueMock, _.noop);
    expect(instance._enqueue('ok', undefined, 1)).resolves.toBe(1);
  });

  it('Enqueue - fail', () => {
    const instance = new Core(console, _.noop, enqueueMock, _.noop);
    expect(instance._enqueue('not ok', undefined, 1)).rejects.toBe(1);
  });

  it('Process single message', () => {
    const instance = new Core(console, _.noop, _.noop, processMock);
    const queueName = 'abc';
    const callback = jest.fn();
    clearProcessCallbacks();
    instance._process(queueName, callback);
    triggerProcess(queueName);
    expect(callback).toHaveBeenCalledWith(queueName);
  });

  it('Process multiple messages', () => {
    const instance = new Core(console, _.noop, _.noop, processMock);
    const queueName = 'def';
    const callback = jest.fn();
    clearProcessCallbacks();
    instance._process(queueName, callback);
    triggerProcess(queueName);
    triggerProcess(queueName);
    triggerProcess(queueName);
    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenLastCalledWith(queueName);
  });

  it('Process multiple messages on multiple queues', () => {
    const instance = new Core(console, _.noop, _.noop, processMock);
    const queueName1 = 'ghi';
    const queueName2 = 'jkl';
    const queueName3 = 'mno';
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    const callback3 = jest.fn();
    clearProcessCallbacks();
    instance._process(queueName1, callback1);
    instance._process(queueName2, callback2);
    instance._process(queueName3, callback3);
    triggerProcess(queueName3);
    triggerProcess(queueName2);
    triggerProcess(queueName1);
    triggerProcess(queueName2);
    triggerProcess(queueName3);
    triggerProcess(queueName3);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback1).toHaveBeenLastCalledWith(queueName1);
    expect(callback2).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenLastCalledWith(queueName2);
    expect(callback3).toHaveBeenCalledTimes(3);
    expect(callback3).toHaveBeenLastCalledWith(queueName3);
  });
});
