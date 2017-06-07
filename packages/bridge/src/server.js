import url from 'url';

import Promise from 'bluebird';
import express from 'express';
import healthcheck from 'express-healthcheck';
import http from 'http';
import engine from 'engine.io';
import _ from 'lodash';
import newrelic from 'newrelic';

import operations from 'collections/lib/operations';
import users from 'collections/lib/users';
import roles from 'collections/lib/roles';
import EntityOnline from 'collections/lib/entityOnline';

import rollbar from 'config/lib/config-rollbar';
import stellar from 'config/lib/config-stellar';
import log from 'config/lib/config-winston';
import { domainUrls } from 'config/lib/config-env';

import { PERMISSIONS, TOKEN_TYPES } from 'enums';

import { StellarCore } from '@stellarjs/core';
import { WebsocketTransport } from '@stellarjs/transport-socket';

import { getFromHost } from 'utils/lib/domain-utils';
import GefenAuthService from 'utils/lib/authService';

import getAccountsClient from './accounts-client';

const clientInitialisers = [];
export default clientInitialisers;

const app = express();
const server = http.createServer(app);
const io = engine.attach(server, { transports: ['polling'] });
const port = process.env.PORT || 8091;

log.info(`Start initializing server on port ${port}`);

const originalHandler = io.handleRequest.bind(io);

io.handleRequest = function handleRequest(req, res) {
    log.info(`handleRequest:${req.method}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    originalHandler(req, res);
};

function loadOperation(request) {
    const domain = getFromHost(_.first(request.headers.host.split(':')));
    log.info(`@StellarBridge.loadOperation: domain=${domain}`);
    return operations().then(oc => oc.find({ domain })
        .project({ _id: 1, domain: 1, domains_info: 1 })
        .limit(1)
        .next());
}

function loadUser(operation, request) {
    const operationId = operation._id;
    const parsedUrl = url.parse(request.url, true);
    const userId = parsedUrl.query['x-auth-user'];
    const authToken = parsedUrl.query['x-auth-token'];
    const authTokenType = parsedUrl.query['x-auth-token-type'] || TOKEN_TYPES.LOGIN;

    log.info(`@StellarBridge.loadUser: username=${userId} authToken=${authToken} type=${authTokenType}`);

    const handleAuthError = () => {
        log.warn(`Authentication Error: ${operationId}, ${userId}, ${authToken}`);
        return users()
            .then(uc => uc.find({ _id: userId }).project({ operation_id: 1 }).limit(1).next())
            .then((user) => {
                if (user == null) {
                    return Promise.reject(new Error('Authentication Error (No user match)'));
                } else if (user.operation_id !== operationId) {
                    return Promise.reject(new Error('Authentication Error (Operation mismatch)'));
                }

                return Promise.reject(new Error('Authentication Error (Invalid)'));
            });
    };

    if (authTokenType === TOKEN_TYPES.API) {
        log.info('@StellarBridge.loadUser: Auth token is an API token');
        return new GefenAuthService({ _id: operationId }).getUserObjectIfAuthenticated(authToken, userId);
    }

    const accountsClient = getAccountsClient(operation);

    log.info(`@StellarBridge.loadUser: Requesting user from heimdall with token ${authToken}`);

    return accountsClient
        .getUser(authToken, { origin: `${domainUrls(operation).backoffice}` })
        .then((user) => {
            if (!user) {
                throw new Error(`Invalid user!`);
            }

            log.info(`Found matching valid user: ${user._id}`);

            return user;
        })
        .catch((e) => {
            log.error(e);

            handleAuthError();
        });
}

function isUserPermitted(operationId, user, permission) {
    return roles(operationId)
        .then(conn => conn.find({ _id: user.role_id, permissions: { $elemMatch: { $eq: permission } } }).count());
}

const onlineVisitors = {};

function startSession(operation, user, socket) {
    const onlineData = {
        authenticatedUserId: user._id,
        requestUserId: user._id,
        sessionId: socket.id,
        operationId: operation._id,
        domain: operation.domain,
        ip: socket.request.connection.remoteAddress,
        reactiveStoppers: {},
        client: new WebsocketTransport(socket, log, true),
        registerStopper: (channel, stopper) => _.assign(onlineData.reactiveStoppers, {
            [channel]: () => {
                log.info(`@StellarBridge: Session ${onlineData.sessionId}: stopped subscription ${channel}`);
                stopper();
                delete onlineData.reactiveStoppers[channel];
            },
        }),
        impersonateUserId: requestUserId => _.assign(onlineData, { requestUserId }),
        headers: () => ({ userId: onlineData.requestUserId, operationId: onlineData.operationId }),
        offlineFn: () => {
            log.info(`@StellarBridge: Session ${onlineData.sessionId} ended session`);
            delete onlineVisitors[user._id];
        },
    };

    onlineVisitors[user._id] = onlineData;

    return onlineData;
}


function sendResponse(client, command, jobDataResp) {
    if (_.isUndefined(client)) {
        log.info('Socket was closed before response was sent.');
        return Promise.reject(new Error('Socket was closed'));
    }

    const resp = jobDataResp.body;
    log.info(`@StellarBridge: bridging response: ${JSON.stringify(resp)}`);
    const headers = _.defaults(
        { requestId: command.jobId, source: stellar.stellarSource() },
        jobDataResp.headers,
    );
    return client.enqueue(
        StellarCore.getNodeInbox(command.data.headers.source),
        { headers, body: resp },
    );
}

function bridgeReactive(client, requestHeaders) {
    return (subscriptionData, channel) => {
        const body = subscriptionData.body;
        log.info(`@StellarBridge: bridging subscription: ${JSON.stringify(subscriptionData)}`);
        const headers = _.defaults(
            { channel, source: stellar.stellarSource() },
            subscriptionData.headers,
        );
        return client.enqueue(
            `stlr:n:${requestHeaders.source}:subscriptionInbox`, // hard coded from StellarPubSub pattern
            { headers, body },
        );
    };
}

function getTxName(requestHeaders) {
    if (requestHeaders.queueName) {
        return `bridge:${requestHeaders.queueName}`;
    }

    return requestHeaders.type;
}

function handleMessage(context, command) {
    const requestHeaders = command.data.headers;

    switch (requestHeaders.type) {
        case 'request': {
            return stellar.request._doQueueRequest(
                requestHeaders.queueName,
                command.data.body,
                _.defaults({ source: stellar.stellarSource() }, requestHeaders),
                { session: context.session, responseType: 'jobData' },
            )
                .then(response => sendResponse(context.session.client, command, response));
        }
        case 'stopReactive': {
            const stopper = context.session.reactiveStoppers[requestHeaders.channel];
            if (stopper) {
                return stopper();
            }

            return Promise.resolve(false);
        }
        case 'reactive': {
            const options = { session: context.session, responseType: 'jobData' };
            const reactiveRequest = {
                results: stellar.request._doQueueRequest(requestHeaders.queueName,
                    command.data.body,
                    _.defaults({ source: stellar.stellarSource() }, requestHeaders),
                    options),
                onStop: stellar.request.pubsub.subscribe(requestHeaders.channel,
                    bridgeReactive(context.session.client, requestHeaders),
                    options),
            };

            reactiveRequest.onStop.then(stopper => context.session.registerStopper(requestHeaders.channel, stopper));

            return reactiveRequest.results.then(response => sendResponse(context.session.client, command, response));
        }
        case 'impersonate': {
            log.info(`@StellarBridge.impersonateUser(${command.data.body.targetUserId})`);
            // TODO convert to middleware stellar.request.use('accounts:impersonate', () =>
            return isUserPermitted(context.operation._id, context.user, PERMISSIONS.IMPERSONATE)
                .then((isPermitted) => {
                    log.info(isPermitted);
                    if (!isPermitted) {
                        // TODO throw new Error(`Invalid impersonation request`);
                        log.error(
                            `@StellarBridge.impersonateUser(${command.data.body.targetUserId}) Invalid impersonation request`); // eslint-disable-line
                        return context.session;
                    }

                    return context.session.impersonateUserId(command.data.body.targetUserId);
                });
        }
        default: {
            throw new Error(`Invalid stellar bridge message: ${JSON.stringify(command)}`);
        }
    }
}

function reportToRollbar(e, context, command) {
    const sessionVars = _.pick(
        context.session,
        ['authenticatedUserId', 'requestUserId', 'sessionId', 'operationId', 'domain', 'ip']);

    if (_.isObject(command)) {
        const bridgeRequestType = _(command).get('data.headers.type', 'noType');
        const queueName = _(command).get('data.headers.queueName');
        const channel = _(command).get('data.headers.channel');
        const path = `${bridgeRequestType}/${queueName || channel || ''}`;
        const method = queueName ? _.last(queueName.split(':')) : undefined;
        const dataHeaders = _.get(command, 'data.headers');

        rollbar.handleError(e, {
            headers: _.assign({}, sessionVars, dataHeaders),
            method,
            route: { path },
            body: _.get(command, 'data.body', JSON.stringify(command)),
        });
    } else {
        rollbar.handleError(e, { headers: sessionVars, body: command });
    }
}

stellar.request.use('^((?!iam:entityOnline).)*$', (req, next, options) => {
    _.assign(req.headers, options.session.headers());
    return next();
});

io.on('connection', (socket) => {
    log.info(`@StellarBridge(${stellar.stellarSource()}): New Connection`);

    const context = {};
    loadOperation(socket.request)
        .then(operation => _.assign(context, { operation }))
        .then(() => loadUser(context.operation, socket.request))
        .then(user => _.assign(context, { user }))
        .then(() => startSession(context.operation, context.user, socket))
        .then(session => _.assign(context, { session }))
        .then(() => EntityOnline.online(context.operation._id, context.user._id, 'user'))
        .then((notifyOffline) => {
            log.info(`@StellarBridge Connected: ${JSON.stringify(context.session.sessionId)}`);

            socket.on('close', () => {
                _.forEach(context.session.reactiveStoppers, (stopper, channel) => {
                    if (stopper) {
                        stopper();
                    } else {
                        log.warn(
                            `@StellarBridge.onclose: Session ${context.session.sessionId}: Unable to find stopper for 
${channel}`);
                    }
                });
                notifyOffline();
                _.invoke(onlineVisitors, `${context.session.authenticatedUserId}.offlineFn`);

                log.info(`@StellarBridge.onclose: Deleting stellar websocket client for session ${context.session.sessionId}`);
                delete context.session.client;
            });

            socket.on('message', (str) => {
                log.info(`@StellarBridge bridging request: ${str}`);

                let command = null;
                try {
                    command = JSON.parse(str);
                } catch (e) {
                    reportToRollbar(e, context, str);
                    return;
                }

                newrelic.createWebTransaction(getTxName(command.data.headers), () =>
                    Promise
                        .try(() => {
                            handleMessage(context, command);
                        })
                        .then(() => newrelic.endTransaction())
                        .catch((e) => {
                            log.error(e);
                            reportToRollbar(e, context, command);
                            newrelic.noticeError(e);
                            newrelic.endTransaction();
                        }),
                )();
            });

            // TODO remove the hiMessage
            const hiMessage = {
                messageType: 'connected',
                message: 'connected to stellar bridge',
                userId: context.session.authenticatedUserId,
            };
            log.info(`@StellarBridge: sending ${JSON.stringify(hiMessage)}`);
            // newrelic.recordMetric('Custom/Bridge/appConnection', completedAppConnection - startAppConnection);
            socket.send(JSON.stringify(hiMessage));
        })
        .catch((e) => {
            rollbar.handleError(e, context);
            log.error(e);
            log.info('Error authentication connection');
            const errorMessage = { messageType: 'error', message: e.message };
            socket.send(JSON.stringify(errorMessage));
        });
});

app.use('/health', healthcheck());
server.listen(port, () => {
    log.info('@StellarBridge: Server is running');
});
