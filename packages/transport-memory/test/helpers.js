import transportFactory from '../src';

export function factory(config) {
  return transportFactory(config);
}

export function jsonifiedFactory(config) {
  return transportFactory({ stringifyDates: true, ...config });
}