/**
 * Created by arolave on 05/10/2016.
 */
/* eslint-disable */
/* global window */

import { configureStellar as coreConfigure } from '@stellarjs/core';
import WebsocketTransport from './WebsocketTransport';
import assign from 'lodash/assign';

let instance;
function transportFactoryGenerator(socket, sendingOnly = false) {
  const fn = (log) => {
    if (!instance) {
      instance = new WebsocketTransport(socket, log, sendingOnly);
    }
    return instance;
  };
  fn.type = `websocket`;
  return fn;
}

function configureStellar(options) {
  return coreConfigure(
    assign(options, { transportFactory: transportFactoryGenerator(options.socket, options.sendingOnly === true)})
  );
}

export { configureStellar, WebsocketTransport };
                                                            