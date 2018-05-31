export default function getTxNameFactory() {
  return function getTxName(requestHeaders) {
    if (requestHeaders.queueName) {
      return `${requestHeaders.queueName}`;
    }

    return requestHeaders.type;
  };
}
