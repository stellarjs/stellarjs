import eio from 'engine.io-client';

import './eio-node-patch';
import stellarSocketFactory from './stellarSocket';

const stellarSocket = stellarSocketFactory(eio);
export default stellarSocket;
