import Promise from 'bluebird';
import eio from 'engine.io-client';

const MAX_RETRIES = 300;
const RECONNECT_INTERVAL = 3000;
const MAX_RECONNECT_INTERVAL = 20000;

const log = console;
let tryToReconnect = true;

// A function that keeps trying, "toTry" until it returns true or has
// tried "max" number of times. First retry has a delay of "delay".
// "callback" is called upon success.
function _exponentialBackoff(toTry, max, delay, maxDelay, callback) {
  log.info(`max:${max}, next delay: ${delay}, tryToReconnect: ${tryToReconnect}`);
  if (!tryToReconnect) {
    return;
  }

  toTry()
        .then((result) => {
          if (callback) {
            callback(result);
          }
        })
        .catch(() => {
          if (max > 0) {
            setTimeout(() => {
              let nextDelay = delay * 1.25;
              if (nextDelay > maxDelay) {
                nextDelay = maxDelay;
              }
              _exponentialBackoff(toTry, max - 1, nextDelay, callback);
            }, delay);
          } else {
            log.info('we give up');
          }
        });
}

const socketWrapper = stellarRequest => ({
  socket: null,
  stellar: stellarRequest(),
  handlers: {},
  state: 'disconnected',
  userId: null,
  _reconnect(url, options) {
    log.info(`@StellarEngineIO: Reconnecting`);
        // eslint-disable-next-line no-use-before-define
    _exponentialBackoff(() => this._doConnect(url, options), MAX_RETRIES, RECONNECT_INTERVAL, MAX_RECONNECT_INTERVAL);
  },

  on(event, handler) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(handler);
  },
  trigger(event) {
    if (event && this.handlers[event]) {
      this.handlers[event].forEach((handler) => {
        handler();
      });
    }
  },
  connect(url, options) {
    log.info(`@StellarEngineIO.connect`);
    tryToReconnect = options.tryToReconnect !== false;
    if (options.sendPings) {
      this.on('open', () => {
        setTimeout(
                    () => {
                      log.info('@StellarEngineIO: sending reactive king');
                      const reactiveRequest = this.stellar.getReactive(
                            'stellarBridge:king', 'stellarBridge:kong:stream', { text: 'king' }, (result) => {
                              log.info(`@StellarEngineIO.getReactive: received stream: ${JSON.stringify(result)}`);
                                // unsubscribe test
                                // reactiveRequest.onStop.then(f => f());
                                // setTimeout(() => {
                                //     const reactiveRequest2 = this.stellar.getReactive(
                                //         'stellarBridge:king', 'stellarBridge:kong:stream', { text: 'king' },
                                //         (r2) => {
                                //             log.info(
                                //                 `@StellarEngineIO.getReactive2: received stream: ${JSON.stringify(r2)}`);
                                //         });
                                //     reactiveRequest2.results.then(r2 => log.info(
                                //         `@StellarEngineIO.getReactive2: received response ${JSON.stringify(r2.text)}`),
                                //     );
                                // }, 1000);
                            });

                      reactiveRequest.results.then(result => log.info(
                            `@StellarEngineIO.getReactive: received response ${JSON.stringify(result.text)}`
                        ));

                      setTimeout(() => {
                        log.info(`@StellarEngineIO.getReactive: stopper`);
                        reactiveRequest.onStop.then(stopper => stopper());
                      }, 12000);


                      log.info('@StellarEngineIO: sending ping');
                      this.stellar
                            .get('stellarBridge:ping', { text: 'ping' })
                            .then(result => log.info(`@StellarEngineIO: received response ${result.text}`));
                    },
                    3000
                );
      });
    }

    this.options = options;
    return this._closeIfNeeded()
          .then(() => this._doConnect(url, options))
          .catch((e) => {
            if (tryToReconnect) {
              return this._reconnect(url, options);
            }
            return e;
          });
  },
  _closeIfNeeded() {
    return new Promise((resolve) => {
      try {
        if (this.socket) {
          log.info('@StellarEngineIO.closeIfNeeded: Already open socket. Closing it before reconnect.');
          this.socket.off('close');
          this.socket.on('close', () => {
            this.socket.off('close');
            log.info(`@StellarEngineIO: Closed`);
            this.stellar.transport.onClose();
            resolve(this.state);
          });
          this.socket.close();
        } else {
          log.info('@StellarEngineIO.closeIfNeeded: Clean slate');
          resolve(this.state);
        }
      } catch (e) {
        log.warn('unable to close socket');
        resolve(this.state);
      }
    });
  },
  _doConnect(url, { userId, token, secure, tokenType, eioConfig = { upgrade: true, rememberUpgrade: true } }) {
    log.info(`@StellarEngineIO._doConnect: ${userId}, ${token}`);
    return new Promise((resolve, reject) => {
      this.state = 'connecting';

      let socketAttempt = null;
      try {
        socketAttempt = new eio.Socket(
                    // eslint-disable-next-line max-len
                    `${secure ? 'wss' : 'ws'}://${url}?x-auth-user=${encodeURIComponent(userId)}&x-auth-token=${encodeURIComponent(token)}&x-auth-token-type=${encodeURIComponent(tokenType)}`,
                    eioConfig
                );
      } catch (e) {
        log.info(`@StellarEngineIO error`, e);
        reject('Connect failed');
      }

      socketAttempt.on('message', (m) => {
        let jam = null;
        try {
          jam = JSON.parse(m);
        } catch (e) {
          log.error('@StellarEngineIO: message ignored', m);
          return;
        }

        if (jam.messageType === 'error') {
          log.error(`@StellarEngineIO: ${jam.message}`);
        } else if (jam.messageType === 'connected') {
          log.info(`@StellarEngineIO: ${jam.message}`);
          this.state = 'connected';
          this.stellar.transport.setSocket(socketAttempt);
          this.socket = socketAttempt;
          this.userId = userId;
          log.info(`@StellarEngineIO: Connected ${this.socket.id} ${this.userId}`);
          this.trigger('open');
          resolve(this.stellar);
        }
      });

      socketAttempt.on('open', () => {
        log.info('@StellarEngineIO: socket open');
      });

      socketAttempt.on('close', () => {
        log.info(`@StellarEngineIO: Closed`);
        this.stellar.transport.onClose();
        if (this.state === 'connected') {
          this.trigger('close');
          this.state = 'disconnected';
          this._reconnect(url, { userId, token, secure });
        }
      });

      socketAttempt.on('error', (e) => {
        log.error(`Socket error`, e);
        this.trigger('error');
        if (this.state === 'connecting') {
          reject('Connect failed');
        }
      });

      socketAttempt.on('upgrade', () => {
        log.info(`@StellarEngineIO.event:'UPGRADE': ${socketAttempt.id}`);
        this.trigger('upgrade');
      });
    });
  },

  close() {
    tryToReconnect = false;

    if (this.socket) {
      log.info(`@StellarEngineIO: Close requested`);
      this.socket.close();
    }
  },
});

export default socketWrapper;
