import WebsocketTransport from './AxiosTransport';

function transportFactory(
  {
    log,
    source,
    axios,
    requestTimeout,
  }) {
  return new WebsocketTransport(axios, source, log, requestTimeout);
}
transportFactory.type = `axios`;

export default transportFactory;
