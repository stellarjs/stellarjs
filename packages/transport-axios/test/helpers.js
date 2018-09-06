import axios from 'axios';
import express from 'express';
import bodyParser from 'body-parser';
import axiosFactory from '../src';
import expressFactory from '../../transport-express/src';

const log = console;

function factory(config) {
    if (config.app === 'app2') {
        const router = express();
        router.use(bodyParser.json());
        const expressTransport = expressFactory({ ...config, router }, true);
        router.listen(9887);

        return expressTransport;
    }

    const instance = axios.create();

    return axiosFactory({ ...config, axios: instance, baseURL: 'http://localhost:9887' }, true);
}

export { log, factory };
