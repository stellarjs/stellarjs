/**
 * Created by arolave on 15/06/2017.
 */
import Promise from 'bluebird';
import { stellarRequest, configureStellar, StellarError } from '@stellarjs/core';
import transportFactory from '@stellarjs/transport-socket';

const MAX_RETRIES = 300;
const RECONNECT_INTERVAL = 3000;
const MAX_RECONNECT_INTERVAL = 20000;

const log = console;

// A function that keeps trying, "toTry" until it returns true or has
// tried "max" number of times. First retry has a delay of "delay".
// "callback" is called upon success.
let tryToReconnect = true;
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

function stellarSocketFactory(eio) {
  configureStellar({ log, transportFactory }).then(() => log.info('@StellarClient initialized'));

  return {
    socket: null,
    handlers: {},
    state: 'disconnected',
    userId: null,
    stellar: stellarRequest(),
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

      this.options = options;
      return this
        ._closeIfNeeded()
        .then(() => this._doConnect(url, options))
        .then((result) => {
          log.info(`@StellarEngineIO connection success`);
          return result;
        })
        .catch((e) => {
          log.info(`@StellarEngineIO connection failed`);
          if (tryToReconnect) {
            return this._reconnect(url, options);
          }
          throw e;
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
            `${secure ? 'wss' : 'ws'}://${url}?x-auth-user=${encodeURIComponent(
              userId)}&x-auth-token=${encodeURIComponent(token)}&x-auth-token-type=${encodeURIComponent(tokenType)}`,
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
            log.error(e, `@StellarEngineIO: message ignored ${m}`);
            return;
          }

          if (jam.messageType === 'error') {
            log.error(`@StellarEngineIO Error: ${jam.message}`);
            tryToReconnect = false;
            socketAttempt.close();
            const ctor = jam.errorType === 'StellarError' ? StellarError : Error;
            reject(new ctor('Authentication Error')); // eslint-disable-line new-cap
          } else if (jam.messageType === 'connected') {
            this.state = 'connected';
            this.stellar.transport.setSocket(socketAttempt);
            this.socket = socketAttempt;
            this.userId = userId;
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
            this.socket = null;
            if (tryToReconnect) {
              this._reconnect(url, { userId, token, secure });
            }
          }
        });

        socketAttempt.on('error', (e) => {
          log.error(e, `Socket error`);
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
  };
}

export default stellarSocketFactory;

