/**
 * Created by arolave on 07/06/2017.
 */
import { expect } from 'chai'; // eslint-disable-line
import chai from 'chai';  // eslint-disable-line
import chaiAsPromised from 'chai-as-promised'; // eslint-disable-line
import Promise from 'bluebird';
import child_process from 'child_process';
import stellarSocket from '@stellarjs/engine.io-client';

const proc = child_process.fork(`${__dirname}/examples/index`); //, null, { env: {PORT: 12555} }

describe('call server', () => {
  it('should work', (done) => {
    Promise
      .delay(5000)
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
        expect(result.text).to.equal('pong');
      })
      .then(() => done())
      .catch((e) => done(e))
      .finally(() => {
        proc.kill('SIGINT');
      });
  }).timeout(10000);
});
