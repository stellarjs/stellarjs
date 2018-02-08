export function getUri(headers) {
  return headers.queueName || headers.channel;
}
