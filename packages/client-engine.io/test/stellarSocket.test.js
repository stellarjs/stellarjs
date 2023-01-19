/**
 * Created by arolave on 14/05/2017.
 */
import _ from 'lodash';
import Promise from 'bluebird';
import qs from 'qs';
import nanoid from 'nanoid';
import StellarError from '@gf-stellarjs/stellar-error';
import stellarSocketFactory from '../src/stellarSocket';

let lastInstance;



function mockEio(trigger) {
  return {
    Socket: jest.fn((url) => {
      const socketInstance = {
        listeners: {},
        on(event, fn) {
          if (!socketInstance.listeners[event]) {
            socketInstance.listeners[event] = [];
          }
          socketInstance.listeners[event].push(fn);
        },
        off(event, fn) {
          if (!fn) {
            socketInstance.listeners[event] = [];
            return;
          }
          _.remove(socketInstance.listeners, listener => listener === fn);
        },
        send(event, ...args) {
          _.forEach(socketInstance.listeners[event], (fn) => {
            fn(args);
          });
        },
        close: jest.fn(() => socketInstance.send('close')),
        id: nanoid(),
      };

      trigger(socketInstance, url);

      lastInstance = socketInstance;
      return socketInstance;
    }),
  };
}

function triggerOpen(instance, url) {
  const parsedQs = qs.parse(_.last(_.split(url, '?')));
  const userId = parsedQs['x-auth-user'];
  const sessionId = parsedQs['x-sessionId'];
  return Promise
  .delay(50)
  .then(() => {
    instance.send('open');
    instance.send('message', JSON.stringify({ messageType: 'connected', userId, sessionId }));
  });
}

function triggerNetworkError(instance) {
  return Promise
      .delay(50)
      .then(() => {
        instance.send('error', 'Terrible XHR Error');
      });
}

function triggerAuthError(instance) {
  return Promise
    .delay(50)
    .then(() => {
      instance.send('open');
      instance.send('message', JSON.stringify({ messageType: 'error', message: 'bad user', errorType: 'StellarError' }));
    });
}

const successEio = mockEio(triggerOpen);
const networkErrorEio = mockEio(triggerNetworkError);
const authErrorEio = mockEio(triggerAuthError);

function trackSocket(mock, stellarSocket) {
  if (!mock.sockets) {
    mock.sockets = [];
  }
  mock.sockets.push(stellarSocket);
}

describe('engine-io client', () => {
  function attachTriggers(stellarSocket) {

    const mocks = {
      open: jest.fn(() => {
        trackSocket(mocks.open, stellarSocket);
        return 1;
      }),
      close: jest.fn(() => {
        trackSocket(mocks.close, stellarSocket);
        return 1;
      }),
      reconnected: jest.fn(() => {
        trackSocket(mocks.reconnected, stellarSocket);
        return 1;
      }),
      error: jest.fn(() => {
        trackSocket(mocks.error, stellarSocket);
        return 1;
      }),
    };

    _.each(mocks, (mock, event) => {
      stellarSocket.on(event, mock);
    });

    return mocks;
  }

  it('should trigger an open event on connection', async () => {
    const stellarSocket = stellarSocketFactory(successEio);
    const mocks = attachTriggers(stellarSocket);

    const connection = stellarSocket.connect('myurl');
    expect(stellarSocket.state).toEqual('connecting'); // must be synchronous

    await connection;
    expect(mocks.open).toHaveBeenCalled();
    expect(mocks.reconnected).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it('should not trigger a reconnect event if tryToReconnect is false', async () => {
    const stellarSocket = stellarSocketFactory(successEio);
    const mocks = attachTriggers(stellarSocket);

    await stellarSocket.connect('myurl', { tryToReconnect: false });
    expect(mocks.open).toHaveBeenCalled();
    expect(mocks.reconnected).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
    lastInstance.send('close');

    await Promise.delay(100);

    expect(mocks.open).toHaveBeenCalled();
    expect(mocks.reconnected).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalled();
  });

  it('should not trigger a reconnect event if close is called manually', async () => {
    const stellarSocket = stellarSocketFactory(successEio);
    const mocks = attachTriggers(stellarSocket);

    await stellarSocket.connect('myurl', { tryToReconnect: false });
    expect(mocks.open).toHaveBeenCalled();
    expect(mocks.reconnected).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
    await stellarSocket.close();

    await Promise.delay(500);

    expect(mocks.open).toHaveBeenCalled();
    expect(mocks.reconnected).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalled();
  });

  it('should trigger an reconnect event if a "network" close occurs', async () => {
    const stellarSocket = stellarSocketFactory(successEio);
    const mocks = attachTriggers(stellarSocket);

    await stellarSocket.connect('myurl', { userId: '1', sessionId: '2' });

    expect(mocks.open).toHaveBeenCalled();
    expect(mocks.reconnected).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.open.sockets[0].userId).toEqual('1');
    expect(mocks.open.sockets[0].sessionId).toEqual('2');

    lastInstance.send('close');
    await Promise.delay(100);

    expect(mocks.open).toHaveBeenCalled();
    expect(mocks.reconnected).toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalled();
    expect(mocks.close.sockets[0].userId).toEqual('1');
    expect(mocks.close.sockets[0].sessionId).toEqual('2');
    expect(mocks.reconnected.sockets[0].userId).toEqual('1');
    expect(mocks.reconnected.sockets[0].sessionId).toEqual('2');
  });

  it('should not trigger an reconnect event if connect is done', async () => {
    const stellarSocket = stellarSocketFactory(successEio);
    const mocks = attachTriggers(stellarSocket);

    await stellarSocket.connect('myurl');
    expect(mocks.open).toHaveBeenCalled();
    expect(mocks.reconnected).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();

    await stellarSocket.connect('myurl2');
    expect(mocks.open).toHaveBeenCalled();
    expect(mocks.reconnected).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it('should throw an error if the connect fails on network error', async () => {
    const stellarSocket = stellarSocketFactory(networkErrorEio);
    const mocks = attachTriggers(stellarSocket);

    try {
      await stellarSocket.connect('myurl', { tryToReconnect: false });
      fail('should have thrown');
    } catch (e) {
      expect(mocks.error).toHaveBeenCalled();
      expect(mocks.open).not.toHaveBeenCalled();
      expect(mocks.reconnected).not.toHaveBeenCalled();
      expect(mocks.close).not.toHaveBeenCalled();
      expect(e).toEqual('Connect failed');
    }
  });

  it('should throw an error if the connect fails on auth error', async () => {
    const stellarSocket = stellarSocketFactory(authErrorEio);
    const mocks = attachTriggers(stellarSocket);

    try {
      await stellarSocket.connect('myurl');
      fail('should have thrown');
    } catch (e) {
      expect(mocks.error).not.toHaveBeenCalled();
      expect(mocks.open).not.toHaveBeenCalled();
      expect(mocks.reconnected).not.toHaveBeenCalled();
      expect(mocks.close).not.toHaveBeenCalled();
      expect(e.constructor).toBe(StellarError);
      expect(e).toEqual(new StellarError('Authentication Error'));
    }
  });

  it('two calls to connect should return two connections', async () => {
    const stellarSocketA = stellarSocketFactory(successEio);

    const socketA = await stellarSocketA.connect('localhost:8091', {
      secure: false,
      userId: '123',
      token: '123',
      tokenType: 'API',
      eioConfig: { upgrade: false },
      params: {
        extraParam: 1,
      },
    });

    const stellarSocketB = stellarSocketFactory(successEio);
    const socketB = await stellarSocketB.connect('localhost:8091', {
      secure: false,
      userId: 'ABC',
      token: 'ABC',
      tokenType: 'API',
      eioConfig: { upgrade: false },
      params: {
        extraParam: 1,
      },
      newInstance: true,
    });

    expect(stellarSocketA.socket.id).not.toEqual(stellarSocketB.socket.id);
    const [realSocketA, realSocketB] = await Promise.all([socketA.transport.socket, socketB.transport.socket]);
    expect(realSocketA.id).not.toEqual(realSocketB.id);
  });
});
