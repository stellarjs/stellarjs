import { getServiceName, getServiceInbox } from '../src/utils';

describe('utils', () => {
  describe('getServiceName', () => {
    it('throws for nil values', () => {
      expect(() => getServiceName(undefined)).toThrow();
      expect(() => getServiceName(null)).toThrow();
    });

    it('works with simple strings', () => {
      expect(getServiceName('test')).toEqual('test');
    });

    it('works with complex strings', () => {
      expect(getServiceName('test.fred:blah:tag')).toEqual('test.fred');
    });
  });


  describe('getServiceInbox', () => {
    it('throws for nil values', () => {
      expect(() => getServiceInbox(undefined)).toThrow();
      expect(() => getServiceInbox(null)).toThrow();
    });

    it('works with simple strings', () => {
      expect(getServiceInbox('test')).toEqual('stlr:s:test:inbox');
    });

    it('works with complex strings', () => {
      expect(getServiceInbox('test.fred:blah:tag')).toEqual('stlr:s:test.fred:inbox');
    });
  });
});