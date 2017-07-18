/**
 * Created by arolave on 29/05/2017.
 */
import http from 'http';
import uuid from 'uuid/v4';
import Promise from 'bluebird';
import { getFromInstanceId } from './common';

export default function run(log) {
  return new Promise((resolve) => {
    http.get({ host: 'http://169.254.169.254', path: '/latest/meta-data/instance-id', timeout: 1000 }, (res) => {
      if (res.statusCode !== 200) {
        log.info(`@StellarCore: Running standard`);
        resolve(getFromInstanceId(uuid()));
      }

      res.setEncoding('utf8');
      let body = '';
      res.on('data', (data) => {
        log.info(`@StellarCore: data ${data}`);
        body += data;
      });
      res.on('end', () => {
        log.info(`@StellarCore: Running in AWS`);
        log.info(`@StellarCore: end ${body}`);
        resolve(getFromInstanceId(body));
      });
    }).on('error', () => {
      log.info(`@StellarCore: Running standard`);
      resolve(getFromInstanceId(uuid()));
    });
  });
}

