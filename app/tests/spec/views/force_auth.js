/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';


define([
  'chai',
  'jquery',
  'sinon',
  'views/force_auth',
  'lib/session',
  'lib/fxa-client',
  'lib/promise',
  'models/reliers/relier',
  'models/auth_brokers/base',
  '../../mocks/window',
  '../../mocks/router',
  '../../mocks/profile',
  '../../lib/helpers'
],
<<<<<<< HEAD
function (chai, $, sinon, View, Session, FxaClient, p, Relier, Broker,
      WindowMock, RouterMock, TestHelpers) {
=======
function (chai, $, sinon, View, Session, FxaClient, p, Relier, WindowMock,
      RouterMock, ProfileMock, TestHelpers) {
>>>>>>> refactor(avatars): remove Session cache and load avatar from server
  var assert = chai.assert;

  describe('/views/force_auth', function () {
    var email;
    var view;
    var router;
    var windowMock;
    var fxaClient;
    var relier;
    var profileClientMock;

    describe('missing email address', function () {
      beforeEach(function () {
        windowMock = new WindowMock();
        windowMock.location.search = '';

        relier = new Relier();
        broker = new Broker();
        fxaClient = new FxaClient();
        profileClientMock = new ProfileMock();

        Session.clear();
        view = new View({
          window: windowMock,
          fxaClient: fxaClient,
          profileClient: profileClientMock,
          relier: relier,
          broker: broker
        });
        return view.render()
            .then(function () {
              $('#container').html(view.el);
            });
      });

      afterEach(function () {
        view.remove();
        view.destroy();
        windowMock = view = null;
      });

      it('prints an error message', function () {
        windowMock.location.search = '';

        assert.notEqual(view.$('.error').text(), '');
      });

      it('shows no avatar if Session.avatar is undefined', function () {
        relier.set('email', 'a@a.com');

        sinon.stub(profileClientMock, 'getAvatar', function () {
          return p({});
        });

        return view.render()
          .then(function () {
            return view.afterVisible();
          })
          .then(function () {
            assert.notOk(view.$('.avatar-view img').length);
          });
      });

      it('shows no avatar when there is no Session.email', function () {
        relier.set('email', 'a@a.com');
        Session.set('avatar', 'avatar.jpg');
        assert.isNull(view.context().avatar);

        return view.render()
          .then(function () {
            assert.notOk(view.$('.avatar-view img').length);
          });
      });

      it('shows avatar when Session.email and relier.email match', function () {
        relier.set('email', 'a@a.com');
        Session.set('email', 'a@a.com');

        sinon.stub(profileClientMock, 'getAvatar', function () {
          return p({ avatar: 'avatar.jpg', id: 'foo' });
        });

        return view.render()
          .then(function () {
            return view.afterVisible();
          })
          .then(function () {
            assert.ok(view.$('.avatar-view img').length);
          });
      });

      it('shows no avatar when Session.email and relier.email do not match', function () {
        relier.set('email', 'a@a.com');
        Session.set('email', 'b@b.com');

        sinon.stub(profileClientMock, 'getAvatar', function () {
          return p({ avatar: 'avatar.jpg', id: 'foo' });
        });

        return view.render()
          .then(function () {
            return view.afterVisible();
          })
          .then(function () {
            assert.notOk(view.$('.avatar-view img').length);
          });
      });
    });

    describe('with email', function () {
      beforeEach(function () {
        email = TestHelpers.createEmail();
        Session.set('prefillPassword', 'password');

        windowMock = new WindowMock();
        windowMock.location.search = '?email=' + encodeURIComponent(email);
        relier = new Relier();
        relier.set('email', email);
        broker = new Broker();
        fxaClient = new FxaClient();
        profileClientMock = TestHelpers.stubbedProfileClient();
        router = new RouterMock();

        view = new View({
          window: windowMock,
          router: router,
          fxaClient: fxaClient,
          profileClient: profileClientMock,
          relier: relier,
          broker: broker
        });
        return view.render()
            .then(function () {
              $('#container').html(view.el);
            });
      });

      afterEach(function () {
        view.remove();
        view.destroy();
        windowMock = router = view = null;
        $('#container').empty();
      });


      it('is able to submit the form', function (done) {
        sinon.stub(view.fxaClient, 'signIn', function () {
          done();
        });
        $('#submit-btn').click();
      });

      describe('submit', function () {
        it('submits the sign in', function () {
          var password = 'password';
          sinon.stub(view.fxaClient, 'signIn', function () {
            return p({
              verified: true
            });
          });
          sinon.stub(view.fxaClient, 'recoveryEmailStatus', function () {
            return p.reject(assert.fail);
          });
          view.$('input[type=password]').val(password);

          return view.submit()
            .then(function () {
              assert.isTrue(view.fxaClient.signIn.calledWith(
                  email, password, relier));
            });
        });
      });

      it('does not print an error message', function () {
        assert.equal(view.$('.error').text(), '');
      });

      it('does not allow the email to be edited', function () {
        assert.equal($('input[type=email]').length, 0);
      });

      it('prefills password', function () {
        assert.equal($('input[type=password]').val(), 'password');
      });

      it('user cannot create an account', function () {
        assert.equal($('a[href="/signup"]').length, 0);
      });

      it('isValid is successful when the password is filled out', function () {
        $('.password').val('password');
        assert.isTrue(view.isValid());
      });

      it('forgot password request redirects directly to confirm_reset_password', function () {
        sinon.stub(view.fxaClient, 'passwordReset', function () {
          return p();
        });

        relier.set('email', email);

        return view.resetPasswordNow()
          .then(function () {

            assert.equal(router.page, 'confirm_reset_password');
            assert.isTrue(view.fxaClient.passwordReset.calledWith(
                email, relier));
          });
      });

      it('only one forget password request at a time', function () {
        var event = $.Event('click');

        view.resetPasswordNow(event);
        return view.resetPasswordNow(event)
          .then(assert.fail, function (err) {
            assert.equal(err.message, 'submit already in progress');
          });
      });
    });
  });
});


