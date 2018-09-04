import instrumentationMockFactory from './factories/instrumentationMockFactory';
import stellarRequestFactory from './factories/stellarRequestFactory';
import defaultStartSessionFactory from './factories/startSessionFactory';
import defaultHandleMessageFactory from './factories/handleMessageFactory';
import defaultReportErrorFactory from './factories/reportErrorFactory';
import defaultCallHandlersSeriallyFactory from './factories/callHandlersSeriallyFactory';

function getOrBuildDefault(config, key, factory) {
  return config[key] ? config[key] : factory(config);
}

function build(config, key, factory) {
  return config[key] ? config[key](config) : factory(config);
}

export default function configureTaskHandlers(config, defaultSendResponseFactory) {
  const stellarRequest = getOrBuildDefault(config, 'stellarRequest', stellarRequestFactory);
  const instrumentation = getOrBuildDefault(config, 'instrumentation', instrumentationMockFactory);

  const factoryConfig = { ...config, stellarRequest };
  const reportError = build(factoryConfig, 'reportErrorFactory', defaultReportErrorFactory);
  const startSession = build(factoryConfig, 'startSessionFactory', defaultStartSessionFactory);
  const callHandlersSerially = build(factoryConfig, 'callHandlersSeriallyFactory', defaultCallHandlersSeriallyFactory);
  const sendResponse = build(factoryConfig, 'sendResponseFactory', defaultSendResponseFactory);

  const handleMessage = build({ ...factoryConfig, sendResponse }, 'handleMessageFactory', defaultHandleMessageFactory);

  return { stellarRequest, instrumentation, reportError, startSession, callHandlersSerially, sendResponse, handleMessage };
}
