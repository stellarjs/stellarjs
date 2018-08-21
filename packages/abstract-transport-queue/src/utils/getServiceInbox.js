import head from 'lodash/head';

function getServiceName(queueName) {
  return head(queueName.split(':')); // eslint-disable-line lodash/prefer-lodash-method
}

function getServiceInbox(queueName) {
  return `stlr:s:${getServiceName(queueName)}:req`;
}

export { getServiceName, getServiceInbox as default };
