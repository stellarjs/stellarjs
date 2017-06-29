import Promise from 'bluebird';
import express from 'express';
import set from 'lodash/get';
import get from 'lodash/get';
import bodyParser from 'body-parser';

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
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  app.post(`${HttpClientTransport.ENQUEUE_URI}`, function (req, res) {
    cb(req, res);
  });
  app.listen(port);
}

beforeAll((done) => {
  httpTransport = new HttpClientTransport({log, hostUrl: `http://localhost`, port: port});
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


describe('HttpClientTransport test simple requests', () => {
  it('send request and receive response', (done) => {
    const reqCommand = createMockCommand();
    httpTransport.process('testing-http-transport', (command) => {
      expect(get(command, 'headers.requestId')).toBe(get(reqCommand, 'headers.id'));
      expect(get(command, 'body.test')).toBe('test');
      done();
    });
    httpTransport.enqueue('testing-http-transport', reqCommand);
  });
});