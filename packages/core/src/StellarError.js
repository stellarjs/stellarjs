/**
 * Created by arolave on 13/11/2016.
 */
import assign from 'lodash/assign';
import isString from 'lodash/isString';
import mapValues from 'lodash/mapValues';
import size from 'lodash/size';
import snakeCase from 'lodash/snakeCase';

function StellarError(message) {
  if (!Error.captureStackTrace) {
    this.stack = (new Error()).stack;
  } else {
    Error.captureStackTrace(this, this.constructor);
  }

  if (message == null || isString(message) || message instanceof String) {
    this.message = message;
    this.errors = {};

    if (size(message)) {
      this.addGeneral(message);
    }
  } else {
    assign(this, message);
  }
}

StellarError.prototype = new Error();
StellarError.prototype.name = 'StellarError';
StellarError.prototype.constructor = StellarError;

StellarError.prototype._add = function fn(key, val) {
  if (!this.errors[key]) {
    this.errors[key] = [];
  }

  this.errors[key] = this.errors[key].concat([val]);
};

StellarError.prototype.addGeneral = function fn(error) {
  this._add('general', error);
};

StellarError.prototype.messageKeys = function fn() {
  return mapValues(this.errors, (v, k) => snakeCase(`${k} ${v}`));
};

StellarError.prototype.addPropertyError = function fn(propertyPath, error) {
  this._add(propertyPath, error);
};

export { StellarError }; // eslint-disable-line import/prefer-default-export
