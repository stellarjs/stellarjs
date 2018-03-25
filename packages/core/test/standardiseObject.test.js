import standardizeObjectFactory from '../src/utils/standardizeObject';

describe('standardizeObject', () => {
  const dateStr = '2018-03-25T08:23:16.000Z';
  const sampleDate = new Date(dateStr);
  it('if on return dates standardized to json', () => {
    const standardizeObject = standardizeObjectFactory({standardizeDates: true});

    expect(standardizeObject(undefined)).toEqual(undefined);
    expect(standardizeObject(null)).toEqual(null);
    expect(standardizeObject(0)).toEqual(0);
    expect(standardizeObject('hi')).toEqual('hi');
    expect(standardizeObject(2.13)).toEqual(2.13);
    expect(standardizeObject('2.13')).toEqual('2.13');
    expect(standardizeObject('2.13')).toEqual('2.13');
    expect(standardizeObject(sampleDate)).toEqual(dateStr);
    expect(standardizeObject([])).toEqual([]);
    expect(standardizeObject(['A', 2])).toEqual(['A', 2]);
    expect(standardizeObject([undefined, null])).toEqual([null, null]);
    expect(standardizeObject([sampleDate])).toEqual([dateStr]);
    expect(standardizeObject({})).toEqual({});
    expect(standardizeObject({ a: 'A', b: 2, c: undefined, d: null })).toEqual({ a: 'A', b: 2, d: null });
    expect(standardizeObject({ a: 'A', b: 2, d: sampleDate, e: { z: sampleDate } }))
      .toEqual({ a: 'A', b: 2, d: dateStr, e: { z: dateStr } });
  });

  it('if off return dates as is', () => {
    const standardizeObject = standardizeObjectFactory({standardizeDates: false});

    expect(standardizeObject(undefined)).toEqual(undefined);
    expect(standardizeObject(null)).toEqual(null);
    expect(standardizeObject(0)).toEqual(0);
    expect(standardizeObject('hi')).toEqual('hi');
    expect(standardizeObject(2.13)).toEqual(2.13);
    expect(standardizeObject('2.13')).toEqual('2.13');
    expect(standardizeObject('2.13')).toEqual('2.13');
    expect(standardizeObject(sampleDate)).toEqual(sampleDate);   // different
    expect(standardizeObject([])).toEqual([]);
    expect(standardizeObject(['A', 2])).toEqual(['A', 2]);
    expect(standardizeObject([undefined, null])).toEqual([undefined, null]);  // also different
    expect(standardizeObject([sampleDate])).toEqual([sampleDate]);
    expect(standardizeObject({})).toEqual({});
    expect(standardizeObject({ a: 'A', b: 2, c: undefined, d: null })).toEqual({ a: 'A', b: 2, d: null });
    expect(standardizeObject({ a: 'A', b: 2, d: sampleDate, e: { z: sampleDate } }))
      .toEqual({ a: 'A', b: 2, d: sampleDate, e: { z: sampleDate } });  // different
  })
});