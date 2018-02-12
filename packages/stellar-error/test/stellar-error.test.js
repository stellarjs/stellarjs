import StellarError from '../src';

describe('StellarError', () => {
  it('should create errors with messages', () => {
    const error = new StellarError('message');
    expect(error.message).toEqual('message');
    expect(error.errors).toEqual({general: ['message']});
    expect(error.messageKeys()).toEqual({general: 'general_message'});

    error.addPropertyError('k', 'v');
    expect(error.errors).toEqual({general: ['message'], k: ['v']});
    expect(error.messageKeys()).toEqual({general: 'general_message', k: 'k_v'});
  });

  it('should be able to override general message', () => {
    const error = new StellarError('message');
    error.addGeneral('override');
    expect(error.message).toEqual('message');
    expect(error.errors).toEqual({general: ['message', 'override']});
  });

  it('should create errors with objects', () => {
    const error = new StellarError({someotherstructure: true});
    expect(error.message).toEqual('');
    expect(error.errors).toEqual(undefined);
    expect(error.someotherstructure).toEqual(true);
    expect(error.messageKeys()).toEqual({});
  })
});