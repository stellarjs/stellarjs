/**
 * Created by arolave on 07/06/2017.
 */
import isObject from 'lodash/isObject';

function stringify(val, log) {
  try {
    if (!val) {
      return '';
    } else if (isObject(val)) {
      return JSON.stringify(val.data || val);
    }
    return val;
  } catch (e) {
    log.error(e);
    return '';
  }
}

export default stringify;

