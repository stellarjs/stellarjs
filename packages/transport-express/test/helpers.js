import axios from 'axios';
import express from 'express';
import bodyParser from 'body-parser';
import axiosFactory from '../../transport-axios/src';
import expressFactory from '../src';

const log = console;

function factory(config) {
    if (config.app === 'app2') {
        const router = express();
        router.use(bodyParser.json());
        const expressTransport = expressFactory({ ...config, router }, true);
        router.listen(9888);

        return expressTransport;
    }

    const instance = axios.create();

    return axiosFactory({ ...config, axios: instance, baseURL: 'http://localhost:9888' }, true);
}

export { log, factory };
