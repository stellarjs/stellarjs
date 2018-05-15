import isArray from 'lodash/isArray';
import isString from 'lodash/isString';
import map from 'lodash/map';
import some from 'lodash/some';

export default function match(url, patternOrArray) {
  if (patternOrArray === undefined) {
    return true;
  }

  const patternsArray = isArray(patternOrArray) ? patternOrArray : [patternOrArray];
  return some(
    map(
      patternsArray,
      pattern => (isString(pattern) ? new RegExp(`^${pattern}$`) : pattern)),
    pattern => url.match(pattern));
}
