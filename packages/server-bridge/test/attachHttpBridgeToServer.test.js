import Promise from 'bluebird';
import _ from 'lodash';
import RedisClient from '@stellarjs/transport-bull/lib-es6/config-redisclient';
import defaultStellarFactory from '../src/factories/defaultStellarFactory';
import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import uuid from 'uuid';

import attachHttpBridgeToServer from '../src/attachHttpBridgeToServer';

const clearRedis = (redisClient) => {
    redisClient = new RedisClient(console);
    if (redisClient.defaultConnection.options.db === 7) {
        console.info('Flush redis');
        return redisClient.defaultConnection.flushdb();
    }
    throw new Error('Redis not in test mode');
};

describe('attachHttpBridgeToServer', () => {
    let redisClient;
    const secret = 'not so secret';
    const stellarFactory = defaultStellarFactory({ log: console });
    const handler = stellarFactory.stellarHandler();

    beforeAll(async () => {
        await clearRedis(redisClient);
        const port = process.env.PORT || 8091;
        console.info('@Bridge: Start initializing server', { port });

        const app = express();
        const server = http.Server(app);
        server.listen(port);

        attachHttpBridgeToServer({
            router: app,
            secret,
            log: console,
        });

        const stellarFactory = defaultStellarFactory({ log: console });

        console.info('beforeAll done');
    });

    beforeEach(async () => {
        console.info('beforeEach done');
    });

    afterEach(async () => {
        await Promise.delay(100);
        console.info('afterEach done');
    });

    afterAll(async () => {
        console.info('afterAll');
        redisClient.defaultConnection.quit();
        return redisClient.closeAll();
    });

    describe('call server', () => {
        it('request response using http bridge', async () => {
            const urlParts = [uuid(), `ping`];
            const stellarUrl = _.join(urlParts, ':');
            const originalHeaders = {
                userId: uuid(),
                operationId: uuid(),
                what: 'ever',
            };

            const token = jwt.sign(originalHeaders, secret);

            handler.get(stellarUrl, ({ headers, body}) => {
                expect(headers).toEqual(expect.objectContaining(originalHeaders));
                expect(body).toEqual('ping');
                return {
                    text: `pong`,
                };
            });
            const httpUrl = `http://localhost:8091/stellarRequest/${_.join(urlParts, '/')}/get`;
            const { data } = await axios.post(httpUrl, { body: 'ping' }, {
                headers: { Authorization: "Bearer " + token }
            });
            expect(data.body.text).toBe('pong');
        });
    });
});
