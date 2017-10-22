/**
 * Created by arolave on 29/05/2017.
 */
import { getFromInstanceId } from './common';

export default function run() {
  if (!process.env.STELLAR_SOURCE) {
    throw new Error('Stellar Startup Error: process.env.STELLAR_SOURCE is missing. Please add to your configuration');
  }
  return getFromInstanceId(process.env.STELLAR_SOURCE);
}
