import AxiosTransport from './AxiosTransport';

function transportFactory(
  {
    log,
    source,
    axios,
    requestTimeout,
    baseURL,
  }) {
  return new AxiosTransport(axios, source, log, requestTimeout, baseURL);
}
transportFactory.type = `axios`;

export default transportFactory;
