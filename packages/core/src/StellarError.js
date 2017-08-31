/**
 * Created by arolave on 13/11/2016.
 */
import assign from 'lodash/assign';
import mapValues from 'lodash/mapValues';
import size from 'lodash/size';
import snakeCase from 'lodash/snakeCase';

function StellarError(message) {
  if (!Error.captureStackTrace) {
    this.stack = (new Error()).stack;
  } else {
    Error.captureStackTrace(this, this.constructor);
  }

  if (message == null || typeof message === 'string' || message instanceof String) {
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

StellarError.prototype._add = function (key, val) { // eslint-disable-line func-names
  if (!this.errors[key]) {
    this.errors[key] = [];
  }

  this.errors[key].push(val);
};

StellarError.prototype.addGeneral = function (error) { // eslint-disable-line func-names
  this._add('general', error);
};

StellarError.prototype.messageKeys = function () { // eslint-disable-line func-names
  return mapValues(this.errors, (v, k) => snakeCase(`${k} ${v}`));
};

StellarError.prototype.addPropertyError = function (propertyPath, error) { // eslint-disable-line func-names
  this._add(propertyPath, error);
};

export { StellarError }; // eslint-disable-line import/prefer-default-export
