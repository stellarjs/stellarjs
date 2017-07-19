const http = require('http');

const StellarHandler = require('@stellarjs/core');

const TransportHttpServer = require('../lib-es6');

const stellarHandler = new StellarHandler(TransportHttpServer());

stellar.handler.get('GET_USERS');

stellar.request.get('GET_USERS');