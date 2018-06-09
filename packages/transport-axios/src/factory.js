import AxiosTransport from './AxiosTransport';

function transportFactory(
  {
    log,
    source,
    axios,
    requestTimeout,
      baseUrl,
  }) {
  return new AxiosTransport(axios, source, log, requestTimeout, baseUrl);
}
transportFactory.type = `axios`;

export default transportFactory;
