const newrelic = jest.genMockFromModule('newrelic');

newrelic.startWebTransaction = jest.fn((path, cb) => cb());

export default newrelic;
