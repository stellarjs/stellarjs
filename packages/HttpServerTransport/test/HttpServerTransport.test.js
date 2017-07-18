import Promise from 'bluebird';
import http from 'http';
import request from 'request';
import get from 'lodash/get';

import HttpServerTransport from '../src/HttpServerTransport';

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

const port = 9993;

function sendMockRequest(cb) {
  request.post({
      url: `http://localhost:${port}${HttpServerTransport.ENQUEUE_URI}`,
      body: createMockCommand(),
      json: true
    },
    cb
  );
}

beforeAll(() => {
  const server = http.createServer();
  httpTransport = new HttpServerTransport({log, server: server});
  server.listen(port);
});

describe('HttpServerTransport test simple requests', () => {
  beforeEach(() => {
    httpTransport.process('testing-http-transport', (command) => {
      command.headers.requestId = command.headers.id;
      command.headers.id = getNewId();
      httpTransport.enqueue('testing-http-transport', command);
    });
  });
  it('send request and receive response', (done) => {
    Promise
      .delay(1500)
      .then(function () {
        sendMockRequest((error, response, responseBody) => {
          const commandBody = get(responseBody, 'body');
          expect(commandBody.test).toBe('test');
          done();
        });
      });
  });
});