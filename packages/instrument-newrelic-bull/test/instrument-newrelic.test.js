import { BullRedisQueueSystem } from '@stellarjs/transport-bull';
import get from 'lodash/get';
import instrumentBullRedisQueueSystem from '../src';

let messageShim;

describe('test instrument newrelic', () => {
  beforeEach(() => {
    messageShim = {
      setLibrary: jest.fn(),
      recordProduce: jest.fn(),
      recordSubscribedConsume: jest.fn(),
      LAST: 'LAST',
      QUEUE: 'QUEUE',
    };
    instrumentBullRedisQueueSystem(messageShim, BullRedisQueueSystem);
  });

  it('Should set Library name as stellarjs', () => {
    expect(messageShim.setLibrary).toBeCalledWith('stellarjs');
  });

  it('Should record transport enqueue', () => {
    const prototype = BullRedisQueueSystem.prototype;
    expect(messageShim.recordProduce).toBeCalledWith(prototype, 'enqueue', expect.any(Function));
    const messageHandler = get(messageShim, 'recordProduce.mock.calls[0][2]');
    const job = {
      body: 'body',
      headers: {
        queueName: 'queueNameInHeader',
      },
    };
    const recordedMessage = messageHandler(messageShim, null, null, ['queueName', job]);
    expect(recordedMessage).toEqual({
      callback: 'LAST',
      destinationName: 'queueNameInHeader',
      destinationType: 'QUEUE',
      headers: job.headers,
      parameters: 'body',
    });
  });

  it('Should record transport process', () => {
    const prototype = BullRedisQueueSystem.prototype;
    expect(messageShim.recordSubscribedConsume).toBeCalledWith(prototype, 'process', expect.any(Object));
    const consumeSpec = get(messageShim, 'recordSubscribedConsume.mock.calls[0][2]');

    expect(consumeSpec).toEqual({ consumer: 'LAST', messageHandler: expect.any(Function) });

    const { messageHandler } = consumeSpec;

    const job = {
      queue: { name: 'queueName' },
      body: 'body',
      data: {
        headers: {
          queueName: 'queueNameInHeader',
        },
      },
    };

    const recordedMessage = messageHandler(messageShim, null, null, [job]);

    expect(recordedMessage).toEqual({
      destinationName: 'queueNameInHeader',
      destinationType: 'QUEUE',
      headers: job.data.headers,
    });
  });
});
