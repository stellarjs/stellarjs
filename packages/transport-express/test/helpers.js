import axiosFactory from '@stellarjs/transport-axios';
import axios from 'axios';
import express from 'express';
import bodyParser from 'body-parser';
import expressFactory from '../src';

const log = console;

function factory(config) {
    if (config.app === 'app2') {
        const router = express();
        router.use(bodyParser.json());
        const expressTransport = expressFactory({ ...config, router }, true);
        router.listen(9887);

        return expressTransport;
    }

    const instance = axios.create({
        baseURL: 'http://localhost:9887',
    });

    return axiosFactory({ ...config, axios: instance }, true);
}

export { log, factory };
