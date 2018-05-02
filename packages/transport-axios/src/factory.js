import AxiosTransport from './AxiosTransport';

function transportFactory(
  {
    log,
    source,
    axios,
    requestTimeout,
  }) {
  return new AxiosTransport(axios, source, log, requestTimeout);
}
transportFactory.type = `axios`;

export default transportFactory;
