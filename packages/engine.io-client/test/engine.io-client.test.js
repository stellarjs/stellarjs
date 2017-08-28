/**
 * Created by arolave on 14/05/2017.
 */
import _ from 'lodash';
import Promise from 'bluebird';
import stellarSocketFactory from '../src/stellarSocket';

let lastInstance;

function triggerOpen(instance) {
  return Promise
  .delay(50)
  .then(() => {
    instance.send('open');
    instance.send('message', JSON.stringify({ messageType: 'connected' }));
  });
}

const eio = {
  Socket: jest.fn(() => {
    const socketInstance = {
      listeners: {},
      on(event, fn) {
        if (!socketInstance.listeners[event]) {
          socketInstance.listeners[event] = [];
        }
        socketInstance.listeners[event].push(fn);
      },
      send(event, ...args) {
        _.forEach(socketInstance.listeners[event], function(fn) { 
          fn(args);
        });
      },
      close: jest.fn(),
    };

    triggerOpen(socketInstance);

    lastInstance = socketInstance;
    return socketInstance;
  }),
};

describe('engine-io client', () => {
  it('should trigger an open event on connection', (done) => {
    const stellarSocket = stellarSocketFactory(eio);
    const triggers = {};

    stellarSocket.on('open', () => {
      triggers.open = Date.now();
    });
    stellarSocket.on('reconnected', () => {
      triggers.reconnect = Date.now();
    });
    stellarSocket.on('close', () => {
      triggers.close = Date.now();
    });

    stellarSocket
      .connect('myurl')
      .then(() => {
        expect(triggers.open).toBeTruthy();
        expect(triggers.reconnect).toBeFalsy();
        expect(triggers.close).toBeFalsy();
        done();
      });
  });

  it('should trigger an reconnect event on reconnection', (done) => {
    const stellarSocket = stellarSocketFactory(eio);
    const triggers = {};

    stellarSocket.on('open', () => {
      triggers.open = Date.now();
    });
    stellarSocket.on('reconnected', () => {
      triggers.reconnect = Date.now();
    });
    stellarSocket.on('close', () => {
      triggers.close = Date.now();
    });

    stellarSocket
      .connect('myurl')
      .then(() => {
        expect(triggers.open).toBeTruthy();
        expect(triggers.reconnect).toBeFalsy();
        expect(triggers.close).toBeFalsy();
      })
      .then(() => {
        lastInstance.send('close');
        return Promise.delay(100);
      })
      .then(() => {
        expect(triggers.open).toBeTruthy();
        expect(triggers.reconnect).toBeTruthy();
        expect(triggers.close).toBeTruthy();
        done();
      });
  });

  it('should not trigger an reconnect event if connnect is done', (done) => {
    const stellarSocket = stellarSocketFactory(eio);
    const triggers = {};

    stellarSocket.on('open', () => {
      triggers.open = Date.now();
    });
    stellarSocket.on('reconnected', () => {
      triggers.reconnect = Date.now();
    });
    stellarSocket.on('close', () => {
      triggers.close = Date.now();
    });

    stellarSocket
      .connect('myurl')
      .then(() => {
        expect(triggers.open).toBeTruthy();
        expect(triggers.reconnect).toBeFalsy();
        expect(triggers.close).toBeFalsy();
      })
      .then(() => stellarSocket.connect('myurl2'))
      .then(() => {
        expect(triggers.open).toBeTruthy();
        expect(triggers.reconnect).toBeFalsy();
        expect(triggers.close).toBeFalsy();
        done();
      });
  });
});
