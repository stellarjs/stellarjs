import Promise from 'bluebird';
import express from 'express';
import bodyParser from 'body-parser';
import request from 'request';
import get from 'lodash/get';

import HttpTransport from '../src/HttpTransport';

const log = console;

let app;
let httpTransport;

function createMockCommand() {
  return {
    data: {
      headers: {
        queueName: 'testing-http-transport',
        type :'request',
        id: String(Date.now()),
      },
      body: {
        test: 'test'
      }
    },
  }
}

function sendMockRequest(cb) {
  console.log(`http://localhost:8091/${HttpTransport.ENQUEUE_URI}`);
  request.post({
      url: `http://localhost:8091${HttpTransport.ENQUEUE_URI}`,
      body: createMockCommand(),
      json: true
    },
    cb
  );
}

beforeAll(() => {
  app = express();
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  httpTransport = new HttpTransport({log, server: app});
  httpTransport.process('testing-http-transport', (command) => {
    httpTransport.enqueue('testing-http-transport', command);
  });
  app.listen(8091);
});

describe('HttpTransport tests', () => {
  it('send request and receive response', (done) => {
    Promise
      .delay(500)
      .then(function () {
        sendMockRequest((error, response, body) => {
          const commandBody = get(body, 'body');
          expect(commandBody.test).toBe('test');
          done();
        });
      });
  });
});