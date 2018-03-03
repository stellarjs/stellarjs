import eio from 'engine.io-client/engine.io';
import stellarSocketFactory from './stellarSocket';

const stellarSocket = stellarSocketFactory(eio, console);
export default stellarSocket;
