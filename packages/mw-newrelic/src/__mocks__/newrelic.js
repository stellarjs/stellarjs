import jest from 'jest'; //eslint-disable-line

const newrelic = jest.genMockFromModule('newrelic');

newrelic.startWebTransaction = jest.fn((path, cb) => cb());

export default newrelic;
