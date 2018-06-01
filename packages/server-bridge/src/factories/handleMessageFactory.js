import StellarError from '@stellarjs/stellar-error';

import head from 'lodash/head';
import last from 'lodash/last';
import isUndefined from 'lodash/isUndefined';
import defaults from 'lodash/defaults';

function sendResponse(log, session, requestHeaders, res) {
  if (session.client === 'http') {
    return res;
  }

  if (isUndefined(session.client)) {
    log.warn(`${session.logPrefix}: Socket was closed before response was sent.`);
    return Promise.reject(new Error('Socket was closed'));
  }

  const queueName = requestHeaders.respondTo;
  const headers = defaults({ requestId: requestHeaders.id, queueName }, res.headers);
  const obj = { headers, body: res.body };
  log.info(`${session.logPrefix} BRIDGE RESPONSE`, { queueName, obj });
  return session.client.send(obj);
}

function sendRequest(log, stellarRequest, session, req) {
  return stellarRequest
        ._doQueueRequest(req.headers.queueName,
            req.body,
            { type: req.headers.type || 'request' },
            { responseType: 'raw', headers: req.headers, session });
}

function bridgeSubscribe(log, session, requestHeaders) {
  return ({ headers, body }) => {
    const queueName = `stlr:n:${requestHeaders.source}:subscriptionInbox`; // queueName hard coded from StellarPubSub pattern
    const socketHeaders = defaults({ queueName }, headers);
    const obj = { headers: socketHeaders, body };

    log.info(`${session.logPrefix} BRIDGE SUBSCRIBE`, { queueName, obj });
    return session.client.send(obj);
  };
}

function subscribe(log, stellarRequest, session, req) {
  const stopper = head(session.reactiveStoppers[req.headers.channel]);
  if (stopper) {
    const message = `Multiple subscriptions to same channel (${
            req.headers.channel}) not supported. First subscription sent ${stopper}`;

    log.warn(session.logPrefix, message);
    const errorResponse = stellarRequest._prepareResponse(req, new StellarError(message));
    return sendResponse(log, session, req.headers, errorResponse);
  }

  const onStop = stellarRequest.pubsub.subscribe(req.headers.channel,
        bridgeSubscribe(log, session, req.headers),
        { responseType: 'raw', session });

  session.registerStopper(req.headers.channel, onStop, req.headers.id);
  return Promise.resolve(true);
}

function request(log, stellarRequest, session, req) {
  return sendRequest(log, stellarRequest, session, req)
        .then(response => sendResponse(log, session, req.headers, response));
}


export default function handleMessageFactory({ log }) {
  return function handleMessage(stellarRequest, session, req) {
    switch (req.headers.type) {
      case 'request': {
        return request(log, stellarRequest, session, req);
      }
      case 'fireAndForget': {
        return sendRequest(log, stellarRequest, session, req);
      }
      case 'subscribe': {
        return subscribe(log, stellarRequest, session, req);
      }
      case 'reactive': {
        return Promise.all([
          request(log, stellarRequest, session, req),
          subscribe(log, stellarRequest, session, req)]);
      }
      case 'stopReactive': {
        const stopper = last(session.reactiveStoppers[req.headers.channel]);
        if (stopper) {
          return stopper();
        }

        return Promise.resolve(false);
      }
      default: {
        throw new Error(`Invalid stellar bridge message: ${JSON.stringify(req)}`);
      }
    }
  };
}
