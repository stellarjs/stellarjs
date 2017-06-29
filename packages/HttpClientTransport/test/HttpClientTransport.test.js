import Promise from 'bluebird';
import express from 'express';
import set from 'lodash/get';
import get from 'lodash/get';

import HttpClientTransport from '../src/HttpClientTransport';

const log = console;

let httpTransport;

function getNewId() {
  return String(Date.now());
}
function createMockCommand() {
  return {
    data: {
      headers: {
        queueName: 'testing-http-transport',
        type :'request',
        id: getNewId(),
      },
      body: {
        test: 'test'
      }
    },
  }
}

const port = 9992;
let app;

function setUpMockServer(cb) {
  app = express();
  app.post(`${HttpClientTransport.ENQUEUE_URI}`, function (req, res) {
    cb(req, res);
  });
  app.listen();
}

describe('HttpServerTransport test simple requests', () => {
  it('send request and receive response', (done) => {
    Promise
      .delay(1500)
      .then(function () {
        const reqCommand = createMockCommand();
        setUpMockServer((req, res) => {
          const command = get(req, 'body');
          set(command, 'headers.requestId', get(command, 'headers.id'));
          set(command, 'headers.id', getNewId());
          res.send(command);
        });
        httpTransport.process('testing-http-transport', (command) => {
          expect(get(command, 'headers.requestId')).toBe(get(reqCommand, 'headers.id'));
          expect(get(command, 'body.test')).toBe('test');
        });

        httpTransport.enqueue('testing-http-transport', reqCommand);
      });
  });
});