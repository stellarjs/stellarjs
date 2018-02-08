import head from 'lodash/head';
import split from 'lodash/split';

function getServiceName(queueName) {
  return head(split(queueName, ':'));
}

function getServiceInbox(queueName) {
  return `stlr:s:${getServiceName(queueName)}:inbox`;
}

export { getServiceName, getServiceInbox };