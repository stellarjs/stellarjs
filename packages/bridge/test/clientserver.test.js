/**
 * Created by arolave on 07/06/2017.
 */
import Promise from 'bluebird';
import child_process from 'child_process';
import stellarSocket from '@stellarjs/engine.io-client';

let proc;
beforeAll(() => {
  proc = child_process.fork(`${__dirname}/examples/index`);
});

afterAll(() => {
  proc.kill('SIGINT');
});

// jest.setTimeout(10000); // for jest 21

describe('call server', () => {
  it('should work', (done) => {
    Promise
      .delay(4000)
      .then(() => stellarSocket.connect('localhost:8091', {
        tryToReconnect: false,
        secure: false,
        userId: '123',
        token: '123',
        tokenType: 'API',
        eioConfig: { upgrade: false },
      }))
      .then(() => stellarSocket.stellar.get('stellarBridge:ping'))
      .then((result) => {
        console.info(JSON.stringify(result));
        expect(result.text).toBe('pong');
        stellarSocket.close();
      })
      .then(() => done())
      .catch((e) => done(e))
  });
});
