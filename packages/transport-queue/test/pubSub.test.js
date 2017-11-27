import _ from 'lodash';
import PubSub from '../src/pubSub';
import { generateIdMock, enqueueMock, processMock, triggerProcess, clearProcessCallbacks } from '../mocks/core.mocks';

describe('PubSub tests', () => {
  it('constructed', () => {
    const instance = new PubSub(console, _.noop, _.noop, _.noop, _.noop, _.noop);
    expect(typeof instance).toBe('object');
  });
});