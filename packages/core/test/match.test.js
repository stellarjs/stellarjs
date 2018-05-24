import match from '../src/utils/match';

describe('match function', () => {
  it('should return true if no pattern', () => {
    expect(match('x:y:get')).toEqual(true);
    expect(match('')).toEqual(true);
    expect(match('a:b:c:d:get', undefined)).toEqual(true);
  });

  it('should return false if types are strings', () => {
    expect(match('x:y:get', null)).toEqual(false);
    expect(match('x:y:get', 1)).toEqual(false);
  });
  
  it('should only exact string patterns match', () => {
    expect(match('x:y:get', 'x:y:get')).toEqual(true);
    expect(match('x:y:get', '')).toEqual(false);
    expect(match('x:y:get1', 'x:y:get')).toEqual(false);
    expect(match('1x:y:get', 'x:y:get')).toEqual(false);
    expect(match('x1:y:get', 'x:y:get')).toEqual(false);
  });

  it('should allow regex matches', () => {
    expect(match('x:y:get', /x:y:get/)).toEqual(true);
    expect(match('x:y:get', new RegExp(''))).toEqual(true);
    expect(match('x:y:get1', /x:y:get/)).toEqual(true);
    expect(match('1x:y:get', /x:y:get/)).toEqual(true);
    expect(match('x1:y:get', /x:y:get/)).toEqual(false);
  });
  
  it('should allow array matches', () => {
    expect(match('x:y:get', [/x:y:get/])).toEqual(true);
    expect(match('x:y:get', [new RegExp('')])).toEqual(true);
    expect(match('x:y:get1', [/x:y:get/])).toEqual(true);
    expect(match('1x:y:get', [/x:y:get/])).toEqual(true);
    expect(match('x1:y:get', [/x:y:get/])).toEqual(false);
    expect(match('x:y:get1', ['', 'x:y:get'])).toEqual(false);
    expect(match('x:y:get', ['', 'x:y:get'])).toEqual(true);
  });

});