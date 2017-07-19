import get from 'lodash/get';
import Promise from 'bluebird';
import { EventEmitter } from 'events';

class HttpClientTransport {
  constructor({hostUrl, log, sendingOnly, port}) {
    this.log = log;
    this.sendingOnly = sendingOnly;
    this.messageHandler = new EventEmitter();
    this.hostUrl = hostUrl + ':' + port + HttpClientTransport.ENQUEUE_URI ;
    this.currentId = 0;
  }

  generateId() {
    return Promise.resolve(this.currentId++); //eslint-disable-line
  }

  enqueue(queueName, command) {
    this.post(command, (resCommand) => {
      this.messageHandler.emit('msg', resCommand);
    });

    return Promise.resolve(command);
  }

  post(data, cb) {
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {//Call a function when the state changes.
      if(xhr.readyState === XMLHttpRequest.DONE) {
        cb(JSON.parse(get(xhr, 'response')));
      }
    };

    xhr.open("POST", this.hostUrl, true);
    xhr.overrideMimeType("application/json");
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhr.setRequestHeader("Connection", "close");
    xhr.send(JSON.stringify(data));
  }

  process(queueName, callback) {
    this.messageHandler.on('msg', (command) => {
      callback(command);
    });
    return Promise.resolve();
  }
}

HttpClientTransport.START_2016 = new Date(2016, 1, 1).getTime();
HttpClientTransport.ENQUEUE_URI = '/stellar/enqueue';

HttpClientTransport.post = function (data, cb) {

};

export default HttpClientTransport;

