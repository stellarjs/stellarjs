export default function getTxName(requestHeaders) {
  if (requestHeaders.queueName) {
    return `${requestHeaders.queueName}`;
  }

  return requestHeaders.type;
}
