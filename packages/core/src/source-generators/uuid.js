/**
 * Created by arolave on 29/05/2017.
 */
import uuid from 'uuid';
import Promise from 'bluebird';
import { getFromInstanceId } from './common';

export default function run() {
  return Promise.resolve(getFromInstanceId(uuid.v4()));
}
