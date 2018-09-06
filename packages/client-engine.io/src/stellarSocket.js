/**
 * Created by arolave on 15/06/2017.
 */
import Promise from 'bluebird';
import qs from 'qs';
import assign from 'lodash/assign';
import forEach from 'lodash/forEach';
import defaults from 'lodash/defaults';
import noop from 'lodash/noop';
import { configureStellar } from '@stellarjs/core';
import StellarError from '@stellarjs/stellar-error';
import transportFactory from '@stellarjs/transport-socket';
import configureExponentialBackoff from './exponentialBackoff';

const MAX_RETRIES = 300;
const RECONNECT_INTERVAL = 3000;
const MAX_RECONNECT_INTERVAL = 20000;

function stellarSocketFactory(eio, log = console) {
  const { stellarRequest } = configureStellar({ log, transportFactory });
  log.info('@StellarClient initialized');

  return {
    socket: null,
    handlers: {},
    state: 'disconnected',
    connectedOnce: false,
    userId: null,
    sessionId: null,
    stellar: stellarRequest(),
    retry: configureExponentialBackoff(MAX_RECONNECT_INTERVAL, log),

    _reconnect(url, options) {
      const reconnectOptions = defaults({ userId: this.userId, sessionId: this.sessionId }, options);
      log.info(`@StellarSocket._reconnect`, { url, socketId: this.socket && this.socket.id, ...reconnectOptions });
      this.retry(() => this._doConnect(url, reconnectOptions), MAX_RETRIES, RECONNECT_INTERVAL);
    },

    on(event, handler) {
      if (!this.handlers[event]) {
        this.handlers[event] = [];
      }
      this.handlers[event] = this.handlers[event].concat([handler]);
    },
    trigger(event) {
      if (event && this.handlers[event]) {
        forEach(this.handlers[event], (handler) => {
          handler();
        });
      }
    },
    connect(url, options = {}) {
      log.info(`@StellarSocket.connect`, { url, options });

      if (options.tryToReconnect === false) {
        this.retry = noop;
      }

      this.options = options;

      return this._closeIfNeeded()
        .then(() => {
          this.connectedOnce = false;
          return this._doConnect(url, options);
        })
        .then((result) => {
          log.info(`@StellarSocket connection success`);
          return result;
        })
        .catch((e) => {
          log.warn(e, `@StellarSocket connection failed`);
          if (this.retry === noop) {
            throw e;
          }
          return this._reconnect(url, options);
        });
    },
    _closeIfNeeded() {
      if (!this.socket) {
        log.info('@StellarSocket.closeIfNeeded: Clean slate');
        this.state = 'connecting'; // aggressively set state to connecting so that is happens synchronously
        return Promise.resolve(this.state);
      }

      return new Promise((resolve) => {
        try {
          log.info('@StellarSocket.closeIfNeeded: Already open socket. Closing it before reconnect.',
            { socketId: this.socket && this.socket.id });
          this.socket.off('close');
          this.socket.on('close', () => {
            this.socket.off('close');
            log.info(`@StellarSocket.closeIfNeeded: Socket Closed`, { socketId: this.socket && this.socket.id });
            this.stellar.transport.onClose();
            this.state = 'connecting'; // aggressively set state to connecting so that is happens synchronously
            resolve(this.state);
          });
          this.socket.close();
        } catch (e) {
          log.warn(e, '@StellarSocket.closeIfNeeded: unable to close socket');
          resolve(this.state);
        }
      });
    },
    _doConnect(url, { userId, token, secure,
        tokenType, sessionId, params, eioConfig = { upgrade: true, rememberUpgrade: true } }) {
      log.info(`@StellarSocket._doConnect`, { url, userId, secure, tokenType, token, sessionId });
      return new Promise((resolve, reject) => {
        this.state = 'connecting';
        const urlParams = assign({ 'x-auth-user': userId,
          'x-auth-token': token,
          'x-auth-token-type': tokenType,
          'x-sessionId': sessionId }, params);
        let socketAttempt = null;
        try {
          socketAttempt = new eio.Socket(`${secure ? 'wss' : 'ws'}://${url}?${qs.stringify(urlParams)}`, eioConfig);
        } catch (e) {
          log.info(e, `@StellarSocket._doConnect`, { url, userId, secure, tokenType, token });
          reject('Connect failed');
        }

        socketAttempt.on('message', (m) => {
          let jam = null;
          try {
            jam = JSON.parse(m);
          } catch (e) {
            log.error(e, `@StellarSocket: message ignored`, { m });
            return;
          }

          if (jam.messageType === 'error') {
            log.error(`@StellarSocket Error`, { m: jam.message });
            this.retry = noop;
            socketAttempt.close();
            const ctor = jam.errorType === 'StellarError' ? StellarError : Error;
            reject(new ctor('Authentication Error')); // eslint-disable-line new-cap
          } else if (jam.messageType === 'connected') {
            this.state = 'connected';
            this.stellar.transport.setSocket(socketAttempt);
            this.socket = socketAttempt;
            this.userId = jam.userId;
            this.sessionId = jam.sessionId;
            this.trigger('open');
            if (this.connectedOnce) {
              this.trigger('reconnected');
            }
            this.connectedOnce = true;
            resolve(this.stellar);
          }
        });

        socketAttempt.on('open', () => {
          log.info('@StellarSocket: socket open');
        });

        socketAttempt.on('close', () => {
          log.info(`@StellarSocket: Closed`);
          this.stellar.transport.onClose();
          if (this.state === 'connected') {
            this.trigger('close');
            this.state = 'disconnected';
            this.socket = null;
            this._reconnect(url, { userId, token, secure, params });
          }
        });

        socketAttempt.on('error', (e) => {
          log.error(e, `Socket error`, { socketId: socketAttempt && socketAttempt.id });
          this.trigger('error');
          if (this.state === 'connecting') {
            reject('Connect failed');
          }
        });

        socketAttempt.on('upgrade', () => {
          log.info(`@StellarSocket.event:'UPGRADE'`, { socketId: socketAttempt && socketAttempt.id });
          this.trigger('upgrade');
        });
      });
    },

    close() {
      this.retry = noop;

      if (this.socket) {
        log.info(`@StellarSocket: Close requested`, { socketId: this.socket && this.socket.id });
        this.socket.close();
      }
    },
  };
}

export default stellarSocketFactory;

