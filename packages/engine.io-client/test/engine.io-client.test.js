/**
 * Created by arolave on 14/05/2017.
 */
import _ from 'lodash';
import Promise from 'bluebird';
import stellarSocketFactory from '../src/stellarSocket';
import uuid from 'uuid/v4';

let lastInstance;

function triggerOpen(instance) {
  return Promise
  .delay(50)
  .then(() => {
    instance.send('open');
    instance.send('message', JSON.stringify({ messageType: 'connected' }));
  });
}


function triggerError(instance) {
    return Promise
      .delay(50)
      .then(() => {
          instance.send('error', 'Terrible XHR Error');
      });
}

function mockEio(trigger) {
    return  {
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
                id: uuid(),
            };

            trigger(socketInstance);

            lastInstance = socketInstance;
            return socketInstance;
        }),
    };
}

const successEio = mockEio(triggerOpen);
const errorEio = mockEio(triggerError);

describe('engine-io client', () => {
  it('should trigger an open event on connection', (done) => {
    const stellarSocket = stellarSocketFactory(successEio);
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
    const stellarSocket = stellarSocketFactory(successEio);
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
    const stellarSocket = stellarSocketFactory(successEio);
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

    it('should throw an error if the connect fails', (done) => {
        const stellarSocket = stellarSocketFactory(errorEio);
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
        stellarSocket.on('error', () => {
            triggers.error = Date.now();
        });

        stellarSocket
          .connect('myurl', { tryToReconnect: false })
          .then(() => {
              expect(triggers.error).toBeTruthy();
              expect(triggers.open).toBeFalsy();
              expect(triggers.reconnect).toBeFalsy();
              expect(triggers.close).toBeFalsy();
          })
          .catch((e) => {
            expect(e).toEqual('Connect failed');
            done();
          });
    });

    it('two calls to connect should return two connections', (done) => {
        const stellarSocketA = stellarSocketFactory(successEio);
        let stellarSocketB;

        const context = {};
        stellarSocketA.connect('localhost:8091', {
            secure: false,
            userId: '123',
            token: '123',
            tokenType: 'API',
            eioConfig: { upgrade: false },
            params: {
                extraParam: 1,
            },
        }).then((socketA) => {
            _.assign(context, { socketA });
            stellarSocketB = stellarSocketFactory(successEio);
            return stellarSocketB.connect('localhost:8091', {
                secure: false,
                userId: 'ABC',
                token: 'ABC',
                tokenType: 'API',
                eioConfig: { upgrade: false },
                params: {
                    extraParam: 1,
                },
                newInstance: true
            });
        }).then((socketB) => {
            expect(stellarSocketA.socket.id).not.toEqual(stellarSocketB.socket.id);
            return [context.socketA.transport.socket, socketB.transport.socket];
        }).all()
          .then(([realSocketA, realSocketB]) => {
            expect(realSocketA.id).not.toEqual(realSocketB.id);
            done();
          });
    });
});
