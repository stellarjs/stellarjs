/**
 * Created by arolave on 13/11/2016.
 */
const assign = require('lodash/assign');
const first = require('lodash/first');
const mapValues = require('lodash/mapValues');
const size = require('lodash/size');
const snakecase = require('lodash/snakecase');

function StellarError(message) { // eslint-disable-line
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

StellarError.prototype._add = function (key, val) {
  if (!this.errors[key]) {
    this.errors[key] = [];
  }

  this.errors[key].push(val);
};

StellarError.prototype.addGeneral = function (error) {
  this._add('general', error);
};

StellarError.prototype.messageKeys = function () {
  return mapValues(this.errors, (v, k) => snakeCase(`${k} ${v}`));
};

StellarError.prototype.addPropertyError = function (propertyPath, error) {
  this._add(propertyPath, error);
};

module.exports = StellarError;
