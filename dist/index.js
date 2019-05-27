"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _express = _interopRequireDefault(require("express"));

var _jsonwebtoken = _interopRequireDefault(require("jsonwebtoken"));

var _bcryptjs = _interopRequireDefault(require("bcryptjs"));

var _uuid = require("uuid");

var _UserSchema = _interopRequireDefault(require("./UserSchema"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var _default =
/*#__PURE__*/
function () {
  function _default(options) {
    _classCallCheck(this, _default);

    this.name = options.name || 'Helio Users';
    this.publicPaths = [new RegExp("^".concat(options.path, "/(login|register)")), "".concat(options.path, "/username/availability")];
    this.needModels = ['User', 'TokenWhitelist'];
    this.subSchemas = {
      User: _UserSchema["default"]
    };
    var self = this;

    var router = this.router = _express["default"].Router();

    router.get('/', this.getSelf.bind(this));
    router["delete"]('/', this.deleteSelf.bind(this));
    router.get('/logout', this.logout.bind(this));
    router.post('/register', this.register.bind(this));
    router.post('/login', this.login.bind(this));
    router.get('/settings', this.getAllSettings.bind(this));
    router.get('/settings/:key', this.getSetting.bind(this));
    router.put('/settings/:key', this.setSetting.bind(this));
    router.get('/client-settings', this.getClientSettings.bind(this));
    router.put('/client-settings', this.setClientSettings.bind(this));
    router.get('/profile', this.getProfile.bind(this));
    router.get('/profile/:key', this.getProfileItem.bind(this));
    router.put('/profile/:key', this.setProfileItem.bind(this));
    router.get('/username', this.getUsername.bind(this));
    router.get('/username/availability', this.checkUsernameAvailability.bind(this));
    router.patch('/username', this.setUsername.bind(this));
    router.patch('/password', this.updatePassword.bind(this));
    router.use(function (err, req, res, next) {
      req.Log.error("[MOD ERROR] (".concat(self.name, ") ").concat(err.stack));
      return res.status(500).json({
        error: err.toString()
      });
    });
  }

  _createClass(_default, [{
    key: "receiveModels",
    value: function receiveModels(models) {
      var _this = this;

      this.models = {};
      this.subModels = {};
      models.forEach(function (model) {
        _this.models[model.name] = model.model;
      });

      for (var parentModelName in this.subSchemas) {
        var parentModel = this.models[parentModelName];
        var subSchema = this.subSchemas[parentModelName];
        this.subModels[parentModelName] = parentModel.discriminator(this.name, subSchema);
      }
    }
  }, {
    key: "revokeToken",
    value: function revokeToken(token) {
      this.models.TokenWhitelist.findOneAndRemove({
        token: token
      }).exec();
    }
  }, {
    key: "getSelf",
    value: function getSelf(req, res, next) {
      this.subModels.User.findOne({
        id: req.user.id
      }).select('-__v -__t -_id -password').then(function (user) {
        res.json(user);
      })["catch"](function (err) {
        return next(err);
      });
    }
  }, {
    key: "deleteSelf",
    value: function deleteSelf(req, res, next) {
      var _this2 = this;

      this.subModels.User.findOneAndRemove({
        id: req.user.id
      }).then(function (user) {
        _this2.revokeToken(req.headers.authorization.replace('Bearer ', ''));

        res.json({
          message: 'Your account has been deleted'
        });
      })["catch"](function (err) {
        return next(err);
      });
    }
  }, {
    key: "logout",
    value: function logout(req, res, next) {
      this.revokeToken(req.headers.authorization.replace('Bearer ', ''));
      res.json({
        message: 'Logged out'
      });
    }
  }, {
    key: "register",
    value: function register(req, res, next) {
      var _this3 = this;

      var _req$body = req.body,
          email = _req$body.email,
          password = _req$body.password; // TODO: Validate, implement bot protection?, etc

      _bcryptjs["default"].hash(password, 10, function (err, hash) {
        if (err) {
          req.Log.error(err);
          return res.status(500).json({
            error: 'Error hashing your password'
          });
        }

        _this3.subModels.User.findOne({
          email: email
        }).then(function (user) {
          if (user) return res.status(403).json({
            error: 'That email address is already linked to an account'
          });
          var roles = ['user'];

          _this3.subModels.User.countDocuments({}).then(function (count) {
            if (count === 0) roles.push('admin');
            user = new _this3.subModels.User({
              id: (0, _uuid.v4)(),
              email: email,
              username: email,
              // Default username is email; can be changed later
              password: hash,
              roles: roles,
              mod: _this3.name
            });
            user.save(function (err, user) {
              if (err) return next(err);
              res.json({
                message: 'User successfully registered'
              });
            });
          });
        })["catch"](function (err) {
          return next(err);
        });
      });
    }
  }, {
    key: "login",
    value: function login(req, res, next) {
      var _this4 = this;

      var _req$body2 = req.body,
          email = _req$body2.email,
          password = _req$body2.password;
      this.subModels.User.findOne({
        email: email,
        roles: 'user'
      }).then(function (user) {
        var err = null;
        if (!user || !user.validPassword(password)) err = true;
        if (err) return res.status(403).json({
          error: 'Invalid email address or password'
        });

        _jsonwebtoken["default"].sign({
          id: user.id,
          email: user.email,
          username: user.username,
          roles: user.roles
        }, process.env.JWT_SECRET, {
          expiresIn: process.env.JWT_TIMEOUT || '1h'
        }, function (err, token) {
          if (err) return res.status(400).json({
            error: 'An error occurred authenticating your account'
          });
          var whitelist = new _this4.models.TokenWhitelist({
            token: token
          });
          whitelist.save();
          res.set('X-AuthToken', token).json({
            token: token
          });
        });
      })["catch"](function (err) {
        return next(err);
      });
    }
  }, {
    key: "getAllSettings",
    value: function getAllSettings(req, res, next) {
      this.subModels.User.findOne({
        id: req.user.id
      }).then(function (user) {
        res.json({
          settings: user.settings
        });
      })["catch"](function (err) {
        return next(err);
      });
    }
  }, {
    key: "getSetting",
    value: function getSetting(req, res, next) {
      this.subModels.User.findOne({
        id: req.user.id
      }).then(function (user) {
        res.json({
          key: req.params.key,
          value: user.settings[req.params.key] || null
        });
      })["catch"](function (err) {
        return next(err);
      });
    }
  }, {
    key: "setSetting",
    value: function setSetting(req, res, next) {
      this.subModels.User.findOne({
        id: req.user.id
      }).then(function (user) {
        user.settings[req.params.key] = req.body.value;
        user.save(function (err) {
          if (err) return next(err);
          res.json({
            message: 'Setting updated'
          });
        });
      })["catch"](function (err) {
        return next(err);
      });
    }
  }, {
    key: "getClientSettings",
    value: function getClientSettings(req, res, next) {
      this.subModels.User.findOne({
        id: req.user.id
      }).select('clientSettings').then(function (user) {
        res.json(user.clientSettings);
      })["catch"](function (err) {
        return next(err);
      });
    }
  }, {
    key: "setClientSettings",
    value: function setClientSettings(req, res, next) {
      this.subModels.User.findOne({
        id: req.user.id
      }).select('clientSettings').then(function (user) {
        // Block unreasonable client setting size
        if (Object.prototype.toString.call(req.body) !== '[object Object]') return res.status(400).json({
          error: 'Client Settings must be an object'
        });
        if (Object.keys(req.body).length > 1024) return res.status(400).json({
          error: 'Client Settings are too large'
        });
        user.clientSettings = req.body;
        user.save(function (err) {
          if (err) return next(err);
          res.json({
            message: 'Client Settings updated'
          });
        });
      })["catch"](function (err) {
        return next(err);
      });
    }
  }, {
    key: "getProfile",
    value: function getProfile(req, res, next) {
      this.subModels.User.findOne({
        id: req.user.id
      }).then(function (user) {
        res.json({
          profile: user.profile
        });
      })["catch"](function (err) {
        return next(err);
      });
    }
  }, {
    key: "getProfileItem",
    value: function getProfileItem(req, res, next) {
      this.subModels.User.findOne({
        id: req.user.id
      }).then(function (user) {
        res.json({
          key: req.params.key,
          value: user.profile[req.params.key] || null
        });
      })["catch"](function (err) {
        return next(err);
      });
    }
  }, {
    key: "setProfileItem",
    value: function setProfileItem(req, res, next) {
      this.subModels.User.findOne({
        id: req.user.id
      }).then(function (user) {
        user.profile[req.params.key] = req.body.value;
        user.save(function (err) {
          if (err) return next(err);
          res.json({
            message: 'Profile updated'
          });
        });
      })["catch"](function (err) {
        return next(err);
      });
    }
  }, {
    key: "getUsername",
    value: function getUsername(req, res, next) {
      this.subModels.User.findOne({
        id: req.user.id
      }).select('username').then(function (user) {
        res.json(user.username);
      })["catch"](function (err) {
        return next(err);
      });
    }
  }, {
    key: "checkUsernameAvailability",
    value: function checkUsernameAvailability(req, res, next) {
      this.subModels.User.countDocuments({
        username: req.body.username
      }).then(function (count) {
        if (count !== 0) return res.status(406).json({
          error: 'Username is unavailable'
        });
        return res.json({
          message: 'Username is available'
        });
      })["catch"](function (err) {
        return next(err);
      });
    }
  }, {
    key: "setUsername",
    value: function setUsername(req, res, next) {
      var _this5 = this;

      this.subModels.User.countDocuments({
        username: req.body.username
      }).then(function (count) {
        if (count !== 0) return res.status(406).json({
          error: 'Username is unavailable'
        });

        _this5.subModels.User.findOneAndUpdate({
          id: req.user.id
        }, {
          username: req.body.username
        }).then(function (user) {
          return res.json({
            message: 'Username updated successfully'
          });
        })["catch"](function (err) {
          return next(err);
        });
      })["catch"](function (err) {
        return next(err);
      });
    }
  }, {
    key: "updatePassword",
    value: function updatePassword(req, res, next) {
      var _req$body3 = req.body,
          currentPassword = _req$body3.currentPassword,
          newPassword = _req$body3.newPassword,
          confirmPassword = _req$body3.confirmPassword;
      this.subModels.User.findOne({
        id: req.user.id
      }).then(function (user) {
        if (user.validPassword(currentPassword)) {
          if (newPassword === confirmPassword) {
            _bcryptjs["default"].hash(newPassword, 10, function (err, hash) {
              if (err) {
                req.Log.error(err);
                return res.status(500).json({
                  error: 'Error hashing your password'
                });
              }

              user.password = hash;
              user.save(function (err) {
                if (err) return res.status(500).json({
                  error: 'There was an error saving your new password'
                });
                return res.json({
                  message: 'Your password has been updated!'
                });
              });
            });
          } else {
            return res.status(400).json({
              error: 'New passwords did not match'
            });
          }
        } else {
          return res.status(400).json({
            error: 'Current password is invalid'
          });
        }
      })["catch"](function (err) {
        return next(err);
      });
    }
  }]);

  return _default;
}();

exports["default"] = _default;