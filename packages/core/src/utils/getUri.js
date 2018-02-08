export default function getUri(headers) {
  return headers.queueName || headers.channel;
}
