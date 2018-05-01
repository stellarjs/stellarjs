import factory from '../src/factory';

describe('factory', () => {
  const log = console;
  const axios = 'fake';

  beforeEach(() => {
  });

  it('test stellarQueueNameToHttpUrl', () => {
    const transport = factory({log, requestTimeout: 1000, optimizeLocalHandlers: false});
    expect(transport.stellarQueueNameToHttpUrl('a:b:c:get')).toEqual('/a/b/c');
  });

});