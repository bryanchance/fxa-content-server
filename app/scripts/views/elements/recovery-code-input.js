/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const AuthErrors = require('../../lib/auth-errors');
const textInput = require('./text-input');
const Vat = require('../../lib/vat');

const element = Object.create(textInput);

element.match = function ($el) {
  return $el.attr('type') === 'text' && $el.hasClass('recovery-code');
};

element.val = function (val) {
  if (arguments.length === 1) {
    return this.__val(val);
  }

  return this.__val().trim();
};

element.validate = function () {
  const value = this.val();

  if (! value.length) {
    throw AuthErrors.toError('RECOVERY_CODE_REQUIRED');
  } else if (Vat.recoveryCode().validate(value).error) {
    throw AuthErrors.toError('INVALID_RECOVERY_CODE');
  }
};

module.exports = element;
