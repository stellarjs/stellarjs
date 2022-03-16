// eslint-disable-next-line lodash/import-scope
import { isArray, isString, some } from 'lodash';


export default function match(url, patternOrArray) {
  if (patternOrArray === undefined) {
    return true;
  }

  const patternsArray = isArray(patternOrArray) ? patternOrArray : [patternOrArray];
  return some(patternsArray, pattern => (isString(pattern) ? url === pattern : url.match(pattern)));
}
