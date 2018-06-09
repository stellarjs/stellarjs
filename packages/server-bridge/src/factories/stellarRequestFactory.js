import { mwLogTraceFactory } from '@stellarjs/mw-log-trace';
import forEach from 'lodash/forEach';

import defaultStellarFactory from './defaultStellarFactory';

export default function stellarRequestFactory({
                                         log,
                                         stellarFactory = defaultStellarFactory({ log }),
                                         middlewares = [],
                                     }) {
  const stellarRequest = stellarFactory.stellarRequest();
  const mwLogTrace = mwLogTraceFactory('HEADERS');
  stellarRequest.use(/.*/, mwLogTrace);

  forEach(middlewares, ({ match, mw }) => stellarRequest.use(match, mw));
  return stellarRequest;
}
