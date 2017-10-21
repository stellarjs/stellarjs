/**
 * Created by arolave on 29/05/2017.
 */
import uuid from 'uuid/v4';
import { getFromInstanceId } from './common';

export default function run() {
  return getFromInstanceId(uuid());
}
