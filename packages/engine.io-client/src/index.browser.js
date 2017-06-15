import eio from 'engine.io-client/engine.io';
import stellarSocketFactory from './stellarSocket';

const stellarSocket = new stellarSocketFactory(eio);
export default stellarSocket;
