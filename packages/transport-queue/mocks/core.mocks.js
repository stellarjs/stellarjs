import Promise from 'bluebird';

export function generateIdMock(queueName) {
  return Promise.resolve(1);
}

export function enqueueMock(queueName, payload, queueMessageId) {
  if (queueName === "ok")
    return Promise.resolve(queueMessageId);

  return Promise.reject(queueMessageId)
}

let callbacks = {};
let processLastCallback = undefined;
export function processMock(queueName, callback) {
  callbacks[queueName] = () => callback(queueName);
}

export function triggerProcess(queueName) {
  callbacks[queueName]();
}

  export function clearProcessCallbacks() {
  callbacks = {};
}