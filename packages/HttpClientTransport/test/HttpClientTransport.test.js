import Promise from 'bluebird';
import express from 'express';
import set from 'lodash/get';
import get from 'lodash/get';
import bodyParser from 'body-parser';

import HttpClientTransport from '../src/HttpClientTransport';

const log = console;

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
let server;

function setUpMockServer(cb) {
  app = express();
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  app.post(`${HttpClientTransport.ENQUEUE_URI}`, function (req, res) {
    cb(req, res);
  });
  server = app.listen(port);
}

beforeAll((done) => {
  setUpMockServer((req, res) => {
    const command = get(req, 'body.data');
    set(command, 'headers.requestId', get(command, 'headers.id'));
    set(command, 'headers.id', getNewId());
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(command);
  });
  Promise
    .delay(1500)
    .then(done);
});

afterAll((done) => {
  Promise
    .delay(200)
    .then(() => {
      process.exit(0);
    });
});

describe('HttpClientTransport test simple requests', () => {
  it('send request and receive response', (done) => {
    const httpTransport = new HttpClientTransport({log, hostUrl: `http://localhost`, port: port});
    const reqCommand = createMockCommand();
    httpTransport.process('testing-http-transport', (command) => {
      expect(get(command, 'headers.requestId')).toBe(get(reqCommand, 'headers.id'));
      expect(get(command, 'body.test')).toBe('test');
      done();
    });
    httpTransport.enqueue('testing-http-transport', reqCommand);
  });
});