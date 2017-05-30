/**
 * Created by arolave on 05/10/2016.
 */
/* eslint-disable */
/* global window */

import { stellarRequest as requestFactory, configureStellar } from '@stellarjs/core';
import WebsocketTransport from './WebsocketTransport';

const stellarRequest = socket => {
    const transportFactory = WebsocketTransport.getInstance.bind(WebsocketTransport, socket, false);
    return requestFactory(transportFactory);
};

export { stellarRequest, configureStellar, WebsocketTransport };
