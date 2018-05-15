import transportFactory from '@stellarjs/transport-axios';
import { configureStellar } from '@stellarjs/core';
import axios from 'axios';

export default function clientFactory({ token, baseUrl }, log) {
  const axiosInstance = axios.create({});
  axiosInstance.defaults.headers.common.Authorization = `Bearer ${token}`; // eslint-disable-line better-mutation/no-mutation

  const { stellarRequest } = configureStellar({ log, transportFactory, axios: axiosInstance, baseUrl });

  return {
    stellar: stellarRequest(),
  };
}
