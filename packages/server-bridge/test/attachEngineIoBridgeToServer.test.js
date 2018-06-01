import Promise from 'bluebird';
import _ from 'lodash';
import url from 'url';
import StellarError from '@stellarjs/stellar-error';
import RedisClient from '@stellarjs/transport-bull/lib-es6/config-redisclient';
import engine from 'engine.io';
import defaultStellarFactory from '../src/factories/defaultStellarFactory';

import attachEngineIoBridgeToServer from '../src/attachEngineIoBridgeToServer';
import instrumentationMockFactory from '../src/factories/instrumentationMockFactory';

const clearRedis = (redisClient) => {
    redisClient = new RedisClient(console);
    if (redisClient.defaultConnection.options.db === 7) {
        console.info('Flush redis');
        return redisClient.defaultConnection.flushdb();
    }
    throw new Error('Redis not in test mode');
};

describe('attachEngineIoBridgeToServer', () => {
    let redisClient;
    let instrumentation = null;
    let server;

    beforeAll(async () => {
        jest.unmock('@stellarjs/transport-bull');
        await clearRedis(redisClient);
        await Promise.delay(100);
        instrumentation = instrumentationMockFactory({ log: console });
        instrumentation.numOfConnectedClients = jest.fn();
        const port = 8091;
        console.info('@Bridge: Start initializing server', { port });
        server = engine.listen(port, { transports: ['websocket', 'polling'] }, () => {
            console.info('@Bridge: Server is running');
        });

        const originalHandler = server.handleRequest.bind(server);
        // eslint-disable-next-line better-mutation/no-mutation
        server.handleRequest = function handleRequest(req, res) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            originalHandler(req, res);
        };

        attachEngineIoBridgeToServer({
            server,
            log: console,
            instrumentation,
            newSessionHandlers: [
                ({ log, socket, session }) => {
                    const request = socket.request;
                    const parsedUrl = url.parse(request.url, true);
                    const userId = parsedUrl.query['x-auth-user'];
                    const queryParams =
                        parsedUrl.query;

                    if (userId === '3') {
                        throw new StellarError('Authentication Error');
                    } else if (userId === '4') {
                        throw new Error('Other Error');
                    }

                    console.info(`QueryParams: ${JSON.stringify(queryParams)}`);
                    Object.assign(session, _.omit(queryParams, ['x-auth-user', 'x-auth-token', 'x-auth-token-type']),
                        { authenticatedUserId: userId });
                    return session;
                },
            ],
        });

        const stellarFactory = defaultStellarFactory({ log: console });

        const PUBLISH_ACTIONS = {
            CREATED: 'CREATED',
            UPDATED: 'UPDATED',
            REMOVED: 'REMOVED',
        };

        const publisher = stellarFactory.stellarAppPubSub();
        function kongEveryHalfSecond() {
            publisher.publish('stellarBridge:kong:stream', { text: `kong` }, { action: PUBLISH_ACTIONS.UPDATED });
            setTimeout(kongEveryHalfSecond, 500);
        }

        const handler = stellarFactory.stellarHandler();
        handler.get('sampleService:ping', () => ({ text: `pong` }));

        handler.update('sampleService:timeout', () => Promise.delay(31 * 1000).then(() => ({ text: `pong` })));
        handler.get('sampleService:pingError', () => {
            throw new Error('pongError');
        });
        handler.handleRequest('sampleService:king:subscribe', () => ({ text: `kong` }));

        setTimeout(kongEveryHalfSecond, 500);

        console.info('beforeAll done');
    });

    beforeEach(async () => {
        console.info('beforeEach done');
    });

    afterEach(async () => {
        await Promise.delay(100);
        instrumentation.numOfConnectedClients.mockReset();
        console.info('afterEach done');
    });

    afterAll(async () => {
        console.info('afterAll');
        server.close();
        redisClient.defaultConnection.quit();
        return redisClient.closeAll();
    });

    describe('call server', () => {
        it('on auth error dont reconnect', (done) => {
            const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
            stellarSocket
                .connect('localhost:8091', {
                    secure: false,
                    userId: '3',
                    token: '123',
                    tokenType: 'API',
                    eioConfig: { upgrade: false },
                })
                .then(() => {
                    fail('error');
                })
                .catch(() => {
                    done();
                });
        });

        it('on other error reconnect automatically', (done) => {
            const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
            stellarSocket
                .connect('localhost:8091', {
                    secure: false,
                    userId: '4',
                    token: '123',
                    tokenType: 'API',
                    eioConfig: { upgrade: false },
                })
                .then(() => {
                    fail('error');
                })
                .catch(Error, (e) => {
                    expect(e).toBeInstanceOf(Error);
                    expect(e.message).toEqual('Authentication Error');
                    done();
                });
        });

        it('instrumentation numOfConnectedClients should work on connection error', (done) => {
            expect(instrumentation.numOfConnectedClients.mock.calls).toEqual([]);
            const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
            stellarSocket
                .connect('localhost:8091', {
                    secure: false,
                    userId: '4',
                    token: '123',
                    tokenType: 'API',
                    eioConfig: { upgrade: false },
                })
                .catch(Error, (e) => {})
                .delay(1000)
                .then(() => {
                    expect(instrumentation.numOfConnectedClients.mock.calls).toEqual([[expect.any(Number), 1], [expect.any(Number), 0]]);
                    done();
                });
        });

        it('instrumentation numOfConnectedClients should work', (done) => {
            const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
            stellarSocket.connect('localhost:8091', {
                secure: false,
                userId: '123',
                token: '123',
                tokenType: 'API',
                eioConfig: { upgrade: false },
                params: {
                    extraParam: 1,
                },
            })
                .then(() => {
                    stellarSocket.close();
                })
                .delay(1000)
                .then(() => {
                    expect(instrumentation.numOfConnectedClients.mock.calls).toEqual([[expect.any(Number), 1], [expect.any(Number), 0]]);
                    done();
                });
        });

        it('request response should work', (done) => {
            const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
            stellarSocket.connect('localhost:8091', {
                secure: false,
                userId: '123',
                token: '123',
                tokenType: 'API',
                eioConfig: { upgrade: false },
                params: {
                    extraParam: 1,
                },
            }).then(() => stellarSocket.stellar.get('sampleService:ping'))
                .then((result) => {
                    expect(result.text).toBe('pong');
                    stellarSocket.close();
                })
                .then(() => {
                    done();
                });
        });

        it('sessionId set - sessionId should equal sessionId header', (done) => {
            const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
            stellarSocket.connect('localhost:8091', {
                secure: false,
                userId: '123',
                sessionId:'456',
                token: '123',
                tokenType: 'API',
                eioConfig: { upgrade: false },
                params: {
                    extraParam: 1,
                },
            }).then(() => {
                expect(stellarSocket.sessionId).toEqual('456');
                expect(stellarSocket.userId).toEqual('123');
                stellarSocket.close();
            })
                .then(() => {
                    done();
                });
        });

        it('no sessionId set - sessionId should equal to socketId ', (done) => {
            const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
            stellarSocket.connect('localhost:8091', {
                secure: false,
                userId: '123',
                token: '123',
                tokenType: 'API',
                eioConfig: { upgrade: false },
                params: {
                    extraParam: 1,
                },
            }).then(() => {
                expect(stellarSocket.sessionId).toBeTruthy();
                expect(stellarSocket.sessionId).toEqual(stellarSocket.socket.id);
                expect(stellarSocket.userId).toEqual('123');
                stellarSocket.close();
            })
                .then(() => {
                    done();
                });
        });

        it('custom timeout should extend normal timeout', (done) => {
            const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
            stellarSocket.connect('localhost:8091', {
                secure: false,
                userId: '123',
                token: '123',
                tokenType: 'API',
                eioConfig: { upgrade: false },
                params: {
                    extraParam: 1,
                },
            })
                .then(() => stellarSocket.stellar.update('sampleService:timeout', {}, { headers: { requestTimeout: 32 * 1000 } }))
                .then(() => {
                    done();
                });
        }, 40 * 1000);

        it('custom timeout should expire', (done) => {
            const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
            stellarSocket.connect('localhost:8091', {
                secure: false,
                userId: '123',
                token: '123',
                tokenType: 'API',
                eioConfig: { upgrade: false },
                params: {
                    extraParam: 1,
                },
            })
                .then(() => stellarSocket.stellar.update('sampleService:timeout', {}, { headers: { requestTimeout: 200 } }))
                .then(() => {
                    fail(`Timeout should have expired.`);
                })
                .catch(() => {
                    done();
                });
        }, 10000);

        it('should getReactive calls', (done) => {
            let reactiveResolve;
            let stopper;
            const reactivePromise = new Promise((resolve) => { reactiveResolve = resolve; });
            const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
            stellarSocket.connect('localhost:8091', {
                secure: false,
                userId: '123',
                token: '123',
                tokenType: 'API',
                eioConfig: { upgrade: false },
            });
            const retval = stellarSocket.stellar.getReactive(
                'sampleService:king',
                'stellarBridge:kong:stream',
                { text: 'king' },
                (reactiveMessage) => {
                    console.info(`@StellarEngineIO.getReactive2: received stream: ${JSON.stringify(reactiveMessage)}`);
                    reactiveResolve(reactiveMessage);
                });
            stopper = retval.onStop;
            retval
                .results
                .then((result) => {
                    console.info('result received');
                    console.info(JSON.stringify(result));
                    expect(result.text).toBe('kong');
                    return reactivePromise;
                })
                .then((reactiveMessage) => {
                    console.info('reactiveMessage received');
                    expect(reactiveMessage).toEqual({ text: 'kong' });
                    return stopper;
                })
                .then((doStop) => {
                    doStop();
                    stellarSocket.close();
                })
                .then(() => {
                    done()
                });
        });

        it('should disallow multiple getReactive calls', (done) => {
            let reactiveResolve;
            const reactivePromise = new Promise((resolve) => { reactiveResolve = resolve; });

            const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
            stellarSocket.connect('localhost:8091', {
                secure: false,
                userId: '123',
                token: '123',
                tokenType: 'API',
                eioConfig: { upgrade: false },
            });
            const retval1 = stellarSocket.stellar.getReactive(
                'sampleService:king',
                'stellarBridge:kong:stream',
                { text: 'king' },
                (reactiveMessage) => {
                    console.info(`@StellarEngineIO.getReactive2: received stream: ${JSON.stringify(reactiveMessage)}`);
                    reactiveResolve(reactiveMessage);
                });

            const retval2 = stellarSocket.stellar.getReactive(
                'sampleService:king',
                'stellarBridge:kong:stream',
                { text: 'king' },
                (reactiveMessage) => {
                    console.info(`@StellarEngineIO.getReactive2: received stream: ${JSON.stringify(reactiveMessage)}`);
                    reactiveResolve(reactiveMessage);
                });

            retval1
                .results
                .then((result) => {
                    console.info('result 1 received');
                    console.info(JSON.stringify(result));
                    expect(result.text).toEqual('kong');
                    return retval2.results;
                })
                .then((result) => {
                    fail(`retval2.result ${JSON.stringify(result)} should NOT be returned`);
                })
                .catch((errorResult) => {
                    console.info('result 2 received');
                    console.info(JSON.stringify(errorResult));
                    expect(_.first(errorResult.message.split(':'))).toMatch('Multiple subscriptions to same channel (stellarBridge');
                    console.info(`Calling stop 1 ${JSON.stringify(retval1)}`);
                    return retval1.onStop;
                })
                .then((doStop1) => {
                    console.info(`Calling stop 1 ${JSON.stringify(doStop1)} ${typeof doStop1}`);
                    doStop1();
                    return retval2.onStop;
                })
                .then(() => {
                    done()
                });
        });

        it('request response should work when errors are thrown', async (done) => {
            const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
            stellarSocket.connect('localhost:8091', {
                secure: false,
                userId: '123',
                token: '123',
                tokenType: 'API',
                eioConfig: { upgrade: false },
            });
            return stellarSocket.stellar
                .get('sampleService:pingError')
                .catch(Error, (e) => {
                    expect(e.message).toBe('pongError');
                    stellarSocket.close();
                    done();
                });
        });
    });
});
