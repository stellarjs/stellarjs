/**
 * Created by arolave on 06/10/2016.
 */
const get = require('lodash/get');
const Promise = require('bluebird');
const { EventEmitter } = require('events');

class WebsocketTransport {
    constructor(socket, log, sendingOnly) {
        this.log = log;
        this.sendingOnly = sendingOnly;
        this.messageHandler = new EventEmitter();

        this.socket = new Promise((resolve, reject) => {
            this.socketResolver = resolve;
            this.socketRejecter = reject;
            this.setSocket(socket);
        });
    }

    setSocket(socket) {
        if (!socket) {
            return;
        }

        if (!this.sendingOnly) {
            socket.on('message', (str) => {
                // log.info(`@Stellar.Websocket message received: ${str}`);
                const command = JSON.parse(str);
                if (get(command, 'queue.name')) {
                    this.messageHandler.emit(command.queue.name, command);
                }
            });
        }

        setTimeout(() => this.socketResolver(socket), 250);
    }

    onClose() {
        this.socket = new Promise((resolve, reject) => {
            this.socketResolver = resolve;
            this.socketRejecter = reject;
        });
    }

    getSubscribers(channel) { // eslint-disable-line no-unused-vars
        return Promise.resolve();
    }

    registerSubscriber(channel, queueName) { // eslint-disable-line no-unused-vars
        return Promise.resolve(() => this._deregisterSubscriber(channel, queueName));
    }

    _deregisterSubscriber(channel, queueName) { // eslint-disable-line no-unused-vars
        return this.enqueue(queueName, { headers: { channel, type: 'stopReactive' } });
    }

    enqueue(queueName, obj) {
        return this.socket.then((s) => {
            const command = {
                queue: { name: queueName }, // TODO remove
                jobId: `${queueName}:${Date.now() - WebsocketTransport.START_2016}:${Math.floor(Math.random() * 10000)}`,
                data: obj,
            };
            const str = JSON.stringify(command);

            s.send(str);
            return command;
        });
    }

    process(queueName, callback) {
        this.messageHandler.on(queueName, (command) => {
            try {
                callback(command);
            } catch (e) {
                this.log.warn('invalid message sent to stellar websocket transport');
            }
        });
        return Promise.resolve();
    }
}

WebsocketTransport.START_2016 = new Date(2016, 1, 1).getTime();

module.exports = WebsocketTransport;

