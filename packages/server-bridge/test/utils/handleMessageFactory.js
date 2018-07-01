import defaultHandleMessageFactory from '../../src/factories/handleMessageFactory';

export default function handleMessageFactory(config) {
  const defaultHandleMessage = defaultHandleMessageFactory(config);
  return function handleMessage(session, req) {
    if (req.headers.fakeHandleMessageError === true) {
      throw new Error('handleMessage DIED!');
    }
    return defaultHandleMessage(session, req);
  }
}