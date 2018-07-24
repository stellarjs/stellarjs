import instrumentationMockFactory from './factories/instrumentationMockFactory';
import stellarRequestFactory from './factories/stellarRequestFactory';

export default function getConfigWithDefaults(config) {
  const stellarRequest = stellarRequestFactory(config);
  return {
    instrumentation: instrumentationMockFactory(config),
    stellarRequest,
    newSessionHandlers: [],
    ...config,
  };
}
