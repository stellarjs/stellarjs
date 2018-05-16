import isArray from 'lodash/isArray';
import isString from 'lodash/isString';
import some from 'lodash/some';

export default function match(url, patternOrArray) {
  if (patternOrArray === undefined) {
    return true;
  }

  const patternsArray = isArray(patternOrArray) ? patternOrArray : [patternOrArray];
  return some(patternsArray, pattern => (isString(pattern) ? url === pattern : url.match(pattern)));
}
