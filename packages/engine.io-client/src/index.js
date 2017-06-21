import eio from 'engine.io-client';
import stellarSocketFactory from './stellarSocket';

const stellarSocket = stellarSocketFactory(eio);
export default stellarSocket;
