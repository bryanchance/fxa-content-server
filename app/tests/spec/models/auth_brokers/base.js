/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define(function (require, exports, module) {
  'use strict';

  const Account = require('models/account');
  const { assert } = require('chai');
  const AuthErrors = require('lib/auth-errors');
  const BaseAuthenticationBroker = require('models/auth_brokers/base');
  const Notifier = require('lib/channels/notifier');
  const p = require('lib/promise');
  const Relier = require('models/reliers/relier');
  const SameBrowserVerificationModel = require('models/verification/same-browser');
  const sinon = require('sinon');
  const WebChannel = require('lib/channels/web');
  const WindowMock = require('../../../mocks/window');

  describe('models/auth_brokers/base', function () {
    let account;
    let broker;
    let notifier;
    let notificationChannel;
    let relier;
    let windowMock;

    beforeEach(function () {
      account = new Account({ uid: 'users_uid' });
      notificationChannel = new WebChannel('web_channel');
      sinon.stub(notificationChannel, 'isFxaStatusSupported', () => false);

      notifier = new Notifier();
      relier = new Relier({ context: 'fx_fennec_v1' });
      windowMock = new WindowMock();

      broker = new BaseAuthenticationBroker({
        notificationChannel,
        notifier,
        relier,
        window: windowMock
      });
    });

    function testDoesNotHalt(behavior) {
      assert.ok(behavior);
      assert.isUndefined(behavior.halt);
      return behavior;
    }

    function testNavigates(expectedEndpoint) {
      return (behavior) => {
        assert.ok(behavior);
        assert.isTrue(behavior.halt);
        assert.equal(behavior.endpoint, expectedEndpoint);
        return behavior;
      };
    }

    describe('fetch', () => {
      beforeEach(() => {
        sinon.stub(broker, '_fetchFxaStatus', () => p());
      });

      describe('fxaStatus not supported', () => {
        it('does not attempt to fetch status from the browser', () => {
          broker.setCapability('fxaStatus', false);

          return broker.fetch()
            .then(() => {
              assert.isFalse(broker._fetchFxaStatus.called);
            });
        });
      });

      describe('fxaStatus is supported', () => {
        it('fetches status from the browser', () => {
          broker.setCapability('fxaStatus', true);

          return broker.fetch()
            .then(() => {
              assert.isTrue(broker._fetchFxaStatus.calledOnce);
            });
        });
      });
    });

    describe('_fetchFxaStatus', () => {
      describe('success', () => {
        it('sets `browserSignedInAccount', () => {
          const signedInUser = {
            email: 'testuser@testuser.com'
          };
          sinon.stub(notificationChannel, 'request', () => p({ signedInUser }));

          return broker._fetchFxaStatus()
            .then(() => {
              assert.deepEqual(broker.get('browserSignedInAccount'), signedInUser);
            });
        });
      });

      describe('INVALID_WEB_CHANNEL error', () => {
        it('sets the fxaStatus capability to false, drops the error', () => {
          sinon.stub(notificationChannel, 'request', () =>
            p.reject(AuthErrors.toError('INVALID_WEB_CHANNEL')));

          return broker._fetchFxaStatus()
            .then(() => {
              assert.isFalse(broker.getCapability('fxaStatus'));
            });
        });
      });

      describe('other errors', () => {
        it('are propagated', () => {
          sinon.stub(notificationChannel, 'request', () =>
            p.reject(AuthErrors.toError('UNEXPECTED_ERROR')));

          return broker._fetchFxaStatus()
            .then(assert.fail, (err) => {
              assert.isTrue(AuthErrors.is(err, 'UNEXPECTED_ERROR'));
            });
        });
      });
    });

    describe('afterLoaded', function () {
      it('returns a promise', function () {
        return broker.afterLoaded()
          .then(assert.pass);
      });

      it('is invoked once on the `view-shown` notification', () => {
        sinon.spy(broker, 'afterLoaded');

        notifier.trigger('view-shown');
        notifier.trigger('view-shown');

        assert.isTrue(broker.afterLoaded.calledOnce);
      });
    });

    describe('persistVerificationData', function () {
      let verificationInfo;

      beforeEach(function () {
        return broker.persistVerificationData(account)
          .then(function () {
            verificationInfo = new SameBrowserVerificationModel({}, {
              namespace: 'context',
              uid: 'users_uid'
            });
            verificationInfo.load();
          });
      });

      it('persist the relier\'s `context` to localStorage', function () {
        assert.equal(verificationInfo.get('context'), 'fx_fennec_v1');
      });
    });

    describe('unpersistVerificationData', function () {
      let verificationInfo;

      beforeEach(function () {
        return broker.persistVerificationData(account)
          .then(function () {
            return broker.unpersistVerificationData(account);
          })
          .then(function () {
            verificationInfo = new SameBrowserVerificationModel({}, {
              namespace: 'context',
              uid: 'users_uid'
            });
            verificationInfo.load();
          });
      });

      it('delete\'s the stored `context` from localStorage', function () {
        assert.isFalse(verificationInfo.has('context'));
      });
    });

    describe('afterChangePassword', function () {
      it('returns a promise', function () {
        return broker.afterChangePassword(account)
          .then(testDoesNotHalt);
      });
    });

    describe('afterCompleteResetPassword', function () {
      beforeEach(function () {
        sinon.spy(broker, 'unpersistVerificationData');
        return broker.afterCompleteResetPassword(account);
      });

      it('unpersistVerificationDatas data', function () {
        assert.isTrue(broker.unpersistVerificationData.calledWith(account));
      });
    });

    describe('afterCompleteSignUp', function () {
      beforeEach(function () {
        sinon.spy(broker, 'unpersistVerificationData');
        return broker.afterCompleteSignUp(account);
      });

      it('unpersistVerificationDatas data', function () {
        assert.isTrue(broker.unpersistVerificationData.calledWith(account));
      });
    });

    describe('afterDeleteAccount', function () {
      it('returns a promise', function () {
        return broker.afterDeleteAccount(account)
          .then(testDoesNotHalt);
      });
    });

    describe('afterResetPasswordConfirmationPoll', function () {
      it('returns a promise', function () {
        return broker.afterResetPasswordConfirmationPoll(account)
          .then(testDoesNotHalt);
      });
    });

    describe('afterSignIn', function () {
      it('returns a promise', function () {
        return broker.afterSignIn(account)
          .then(testDoesNotHalt);
      });
    });

    describe('afterSignInConfirmationPoll', function () {
      it('returns a promise, behavior navigates to signin_confirmed', function () {
        return broker.afterSignInConfirmationPoll(account)
          .then(testNavigates('signin_confirmed'));
      });
    });

    describe('afterForceAuth', function () {
      it('returns a promise', function () {
        return broker.afterForceAuth(account)
          .then(testDoesNotHalt);
      });
    });

    describe('beforeSignIn', function () {
      it('returns a promise', function () {
        return broker.beforeSignIn(account)
          .then(testDoesNotHalt);
      });
    });

    describe('afterSignUpConfirmationPoll', function () {
      it('returns a promise, behavior navigates to signup_confirmed', function () {
        return broker.afterSignUpConfirmationPoll(account)
          .then(testNavigates('signup_confirmed'));
      });
    });

    describe('beforeSignUpConfirmationPoll', function () {
      it('returns a promise', function () {
        return broker.beforeSignUpConfirmationPoll(account)
          .then(testDoesNotHalt);
      });
    });

    describe('transformLink', function () {
      it('does nothing to the link', function () {
        assert.equal(broker.transformLink('signin'), 'signin');
      });
    });

    describe('isForceAuth', function () {
      it('returns `false` by default', function () {
        assert.isFalse(broker.isForceAuth());
      });

      it('returns `true` if flow began at `/force_auth`', function () {
        windowMock.location.pathname = '/force_auth';
        return broker.fetch()
          .then(function () {
            assert.isTrue(broker.isForceAuth());
          });
      });
    });

    describe('isAutomatedBrowser', function () {
      it('returns `false` by default', function () {
        assert.isFalse(broker.isAutomatedBrowser());
      });

      it('returns `true` if the URL contains `isAutomatedBrowser=true`', function () {
        windowMock.location.search = '?automatedBrowser=true';
        return broker.fetch()
          .then(function () {
            assert.isTrue(broker.isAutomatedBrowser());
          });
      });
    });

    describe('capabilities', function () {
      describe('hasCapability', function () {
        it('returns `false` by default', function () {
          assert.isFalse(broker.hasCapability('some-capability'));
        });

        it('returns `false` if the capability\'s value is falsy', function () {
          broker.setCapability('some-capability', false);
          assert.isFalse(broker.hasCapability('some-capability'));

          broker.setCapability('some-capability', undefined);
          assert.isFalse(broker.hasCapability('some-capability'));

          broker.setCapability('some-capability', null);
          assert.isFalse(broker.hasCapability('some-capability'));

          broker.setCapability('some-capability', 0);
          assert.isFalse(broker.hasCapability('some-capability'));
        });

        it('returns `true` if `setCapability` was called with truthy value', function () {
          broker.setCapability('some-capability', { key: 'value' });
          assert.isTrue(broker.hasCapability('some-capability'));

          broker.setCapability('other-capability', true);
          assert.isTrue(broker.hasCapability('other-capability'));

          broker.unsetCapability('other-capability');
          assert.isFalse(broker.hasCapability('other-capability'));
        });

        it('returns `true` for `signup` by default', function () {
          assert.isTrue(broker.hasCapability('signup'));
        });

        it('returns `true` for `handleSignedInNotification` by default', function () {
          assert.isTrue(broker.hasCapability('handleSignedInNotification'));
        });

        it('returns `true` for `emailVerificationMarketingSnippet` by default', function () {
          assert.isTrue(broker.hasCapability('emailVerificationMarketingSnippet'));
        });
      });

      describe('getCapability', function () {
        it('returns `undefined` by default', function () {
          assert.isUndefined(broker.getCapability('missing-capability'));
        });

        it('returns the capability value if available', function () {
          const capabilityMetadata = { key: 'value' };
          broker.setCapability('some-capability', capabilityMetadata);
          assert.deepEqual(
            broker.getCapability('some-capability'), capabilityMetadata);


          broker.unsetCapability('some-capability');
          assert.isUndefined(broker.getCapability('some-capability'));
        });
      });
    });

    describe('getBehavior', function () {
      it('gets a behavior, if defined', function () {
        const behavior = broker.getBehavior('beforeSignIn');
        assert.isDefined(behavior);
      });

      it('throws if behavior is not defined', function () {
        assert.throws(function () {
          broker.getBehavior('NOT_SET');
        }, 'behavior not found for: NOT_SET');
      });
    });

    describe('setBehavior', function () {
      it('sets a behavior', function () {
        broker.setBehavior('new behavior', { halt: true });
        assert.isTrue(broker.getBehavior('new behavior').halt);
      });
    });
  });
});
