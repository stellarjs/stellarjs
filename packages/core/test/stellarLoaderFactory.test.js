import _ from 'lodash';
import stellarLoaderFactory from '../src/stellarLoaderFactory';

describe('stellarLoaderFactory', () => {
  let loader;
  let stellarHandler;

  beforeEach(() => {
    stellarHandler = {
      handleRequest: jest.fn(),
      use: jest.fn()
    };
    
    loader = stellarLoaderFactory(stellarHandler);
  });

  it('basic handler function should send be registered', () => {
    const mockFn = jest.fn();
    loader('testservice:resource', {create: mockFn});
    expect(stellarHandler.handleRequest.mock.calls).toHaveLength(1);
    expect(stellarHandler.handleRequest.mock.calls[0]).toHaveLength(2);
    expect(stellarHandler.handleRequest.mock.calls[0][0]).toEqual('testservice:resource:create');
    stellarHandler.handleRequest.mock.calls[0][1]({headers: 'foo', body: 'bar'});
    expect(stellarHandler.handleRequest.mock.calls).toHaveLength(1);
    expect(mockFn.mock.calls[0]).toEqual(['foo', 'bar']);
    expect(stellarHandler.use.mock.calls).toHaveLength(0);
  });

  it('deep handler function should send be registered', () => {
    const mockFn = jest.fn();
    loader('testservice:resource', {create: {do: mockFn}});
    expect(stellarHandler.handleRequest.mock.calls).toHaveLength(1);
    expect(stellarHandler.handleRequest.mock.calls[0]).toHaveLength(2);
    expect(stellarHandler.handleRequest.mock.calls[0][0]).toEqual('testservice:resource:do:create');
    stellarHandler.handleRequest.mock.calls[0][1]({headers: 'foo', body: 'bar'});
    expect(stellarHandler.handleRequest.mock.calls).toHaveLength(1);
    expect(mockFn.mock.calls[0]).toEqual(['foo', 'bar']);
    expect(stellarHandler.use.mock.calls).toHaveLength(0);
  });
  
  it('array with handler & no middleware should register the handler', () => {
    const mockFn = jest.fn();
    loader('testservice:resource', {create: [mockFn]});
    expect(stellarHandler.handleRequest.mock.calls).toHaveLength(1);
    expect(stellarHandler.handleRequest.mock.calls[0]).toHaveLength(2);
    expect(stellarHandler.handleRequest.mock.calls[0][0]).toEqual('testservice:resource:create');
    stellarHandler.handleRequest.mock.calls[0][1]({headers: 'foo', body: 'bar'});
    expect(stellarHandler.handleRequest.mock.calls).toHaveLength(1);
    expect(mockFn.mock.calls[0]).toEqual(['foo', 'bar']);
    expect(stellarHandler.use.mock.calls).toHaveLength(0);
  });

  it(`array with handler & middleware should register the handler & middleware`, () => {
    const mockFn = jest.fn();
    const mockMw = jest.fn();
    loader('testservice:resource', {create: [mockFn, mockMw]});
    expect(stellarHandler.handleRequest.mock.calls).toHaveLength(1);
    expect(stellarHandler.handleRequest.mock.calls[0]).toHaveLength(2);
    expect(stellarHandler.handleRequest.mock.calls[0][0]).toEqual('testservice:resource:create');
    stellarHandler.handleRequest.mock.calls[0][1]({headers: 'foo', body: 'bar'});
    expect(stellarHandler.handleRequest.mock.calls).toHaveLength(1);
    expect(mockFn.mock.calls[0]).toEqual(['foo', 'bar']);

    expect(stellarHandler.use.mock.calls).toHaveLength(1);
    expect(stellarHandler.use.mock.calls[0]).toHaveLength(2);
    expect(stellarHandler.use.mock.calls[0]).toEqual(['testservice:resource:create', mockMw]);
  });

  it('array with handler & 2 middlewares should register all', () => {
    const mockFn = jest.fn();
    const mockMws = [jest.fn(), jest.fn()];
    loader('testservice:resource', {create: [mockFn].concat(mockMws)});
    expect(stellarHandler.handleRequest.mock.calls).toHaveLength(1);
    expect(stellarHandler.handleRequest.mock.calls[0]).toHaveLength(2);
    expect(stellarHandler.handleRequest.mock.calls[0][0]).toEqual('testservice:resource:create');
    stellarHandler.handleRequest.mock.calls[0][1]({headers: 'foo', body: 'bar'});
    expect(stellarHandler.handleRequest.mock.calls).toHaveLength(1);
    expect(mockFn.mock.calls[0]).toEqual(['foo', 'bar']);

    expect(stellarHandler.use.mock.calls).toHaveLength(2);
    expect(stellarHandler.use.mock.calls[0]).toHaveLength(2);
    expect(stellarHandler.use.mock.calls[0]).toEqual(['testservice:resource:create', mockMws[0]]);
    expect(stellarHandler.use.mock.calls[1]).toHaveLength(2);
    expect(stellarHandler.use.mock.calls[1]).toEqual(['testservice:resource:create', mockMws[1]]);
  });

  it('no handler should throw Error', () => {
    expect(() => loader('testservice:resource', {create: undefined})).toThrow(new Error('stellarLoaderFactory: no function defined for testservice:resource.create'));
    expect(stellarHandler.handleRequest.mock.calls).toHaveLength(0);
    expect(stellarHandler.use.mock.calls).toHaveLength(0);
  });
});