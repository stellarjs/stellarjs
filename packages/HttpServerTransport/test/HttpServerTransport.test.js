import Promise from 'bluebird';
import http from 'http';
import request from 'request';
import get from 'lodash/get';

import {StellarHandler, StellarRequest} from '@stellarjs/core';

import HttpServerTransport from '../src/HttpServerTransport';
import HttpClientTransport from '@stellarjs/HttpClientTransport';

const log = console;

let httpTransport;

function getNewId() {
  return String(Date.now());
}
function createMockCommand() {
  return {
    headers: {
      queueName: 'testing-http-transport',
      type :'request',
      id: getNewId(),
    },
    body: {
      test: 'test'
    }
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

let server;
beforeEach(() => {
  server = http.createServer();
  httpTransport = new HttpServerTransport({log, server: server});
  server.listen(port);
});

afterEach(() => {
  server.close();
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

describe('E2E', () => {
  it('Send message from client to server', (done) => {
    const stellarHandler = new StellarHandler(httpTransport, 'test', console, 1000);

    stellarHandler.get('test:resource', () => {
      return 10;
    });

    const httpClientTransport = HttpClientTransport({log: console, hostUrl: `http://localhost`, port});
    const stellarRequest = new StellarRequest(httpClientTransport, 'test', console, 1000);

    stellarRequest.get('test:resource')
      .then((res) => {
        expect(res).toBe(10);
        done();
      });

  });
});