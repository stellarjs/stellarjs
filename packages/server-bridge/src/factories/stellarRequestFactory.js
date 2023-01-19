import { mwLogTraceFactory } from '@gf-stellarjs/mw-log-trace';
import assign from 'lodash/assign';
import forEach from 'lodash/forEach';

import defaultStellarFactory from './defaultStellarFactory';

export default function stellarRequestFactory({
                                         log,
                                         sourcePrefix,
                                         stellarFactory = defaultStellarFactory({ log, sourcePrefix }),
                                         middlewares = [],
                                         bridgedUrlPatterns = /.*/,
                                     }) {
  const stellarRequest = stellarFactory.stellarRequest();
  const mwLogTrace = mwLogTraceFactory('HEADERS');
  stellarRequest.use(/.*/, mwLogTrace);

  if (bridgedUrlPatterns) {
    stellarRequest.use(bridgedUrlPatterns, (req, next, options) => {
      if (req.headers.type === 'publish') {
        return next();
      }

      assign(req.headers, options.session.headers);
      return next();
    });
  }

  forEach(middlewares, ({ match, mw }) => stellarRequest.use(match, mw));
  return stellarRequest;
}
