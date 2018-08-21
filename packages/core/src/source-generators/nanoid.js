/**
 * Created by arolave on 29/05/2017.
 */
import nanoid from 'nanoid';
import { getFromInstanceId } from './common';

export default function run() {
  return getFromInstanceId(nanoid(10));
}
