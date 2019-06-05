import express from 'express'
import jsonwebtoken from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'

import UserSchema from './UserSchema'

export default class {
  constructor (options) {
    this.name = options.name || 'Helio Users'
    this.publicPaths = [new RegExp(`^${options.path}/(login|register)`), `${options.path}/username/availability`]
    this.needModels = ['User', 'TokenWhitelist']
    this.subSchemas = { User: UserSchema }

    const self = this
    const router = this.router = express.Router()

    router.get('/', this.getSelf.bind(this))
    router.delete('/', this.deleteSelf.bind(this))
    router.get('/logout', this.logout.bind(this))
    router.post('/register', this.register.bind(this))
    router.post('/login', this.login.bind(this))
    router.get('/settings', this.getAllSettings.bind(this))
    router.get('/settings/:key', this.getSetting.bind(this))
    router.put('/settings/:key', this.setSetting.bind(this))
    router.get('/client-settings', this.getClientSettings.bind(this))
    router.put('/client-settings', this.setClientSettings.bind(this))
    router.get('/profile', this.getProfile.bind(this))
    router.get('/profile/:key', this.getProfileItem.bind(this))
    router.put('/profile/:key', this.setProfileItem.bind(this))
    router.get('/username', this.getUsername.bind(this))
    router.get('/username/availability', this.checkUsernameAvailability.bind(this))
    router.patch('/username', this.setUsername.bind(this))
    router.patch('/password', this.updatePassword.bind(this))

    router.use(function (err, req, res, next) {
      req.Log.error(`[MOD ERROR] (${self.name}) ${err.stack}`)
      return res.status(500).json({ error: err.toString() })
    })
  }

  receiveModels (models) {
    this.models = {}
    this.subModels = {}

    models.forEach(model => {
      this.models[model.name] = model.model
    })

    for (const parentModelName in this.subSchemas) {
      const parentModel = this.models[parentModelName]
      const subSchema = this.subSchemas[parentModelName]
      this.subModels[parentModelName] = parentModel.discriminator(this.name, subSchema)
    }
  }

  revokeToken (token) {
    this.models.TokenWhitelist.findOneAndRemove({ token }).exec()
  }

  getSelf (req, res, next) {
    this.subModels.User.findOne({ id: req.user.id }).select('-__v -__t -_id -password')
      .then(user => {
        res.json(user)
      })
      .catch(err => next(err))
  }

  deleteSelf (req, res, next) {
    this.subModels.User.findOneAndRemove({ id: req.user.id })
      .then(user => {
        this.revokeToken(req.headers.authorization.replace('Bearer ', ''))
        res.json({ message: 'Your account has been deleted' })
      })
      .catch(err => next(err))
  }

  logout (req, res, next) {
    this.revokeToken(req.headers.authorization.replace('Bearer ', ''))
    res.json({ message: 'Logged out' })
  }

  register (req, res, next) {
    const { email, password } = req.body
    // TODO: Validate, implement bot protection?, etc

    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        req.Log.error(err)
        return res.status(500).json({ error: 'Error hashing your password' })
      }

      this.subModels.User
        .findOne({ email })
        .then(user => {
          if (user) return res.status(403).json({ error: 'That email address is already linked to an account' })

          const roles = ['user']
          this.subModels.User.countDocuments({}).then(count => {
            if (count === 0) roles.push('admin')

            user = new this.subModels.User({
              id: uuid(),
              email,
              username: email, // Default username is email; can be changed later
              password: hash,
              roles,
              mod: this.name
            })

            user.save((err, user) => {
              if (err) return next(err)
              res.json({ message: 'User successfully registered' })
            })
          })
        })
        .catch(err => next(err))
    })
  }

  login (req, res, next) {
    const { email, password } = req.body

    this.subModels.User.findOne({ email, roles: 'user' })
      .then(user => {
        let err = null
        if (!user || !user.validPassword(password)) err = true
        if (err) return res.status(403).json({ error: 'Invalid email address or password' })

        jsonwebtoken.sign({
          id: user.id,
          email: user.email,
          username: user.username,
          roles: user.roles
        }, req.app.get('HELIO_JWT_SECRET'),
        {
          expiresIn: req.app.get('HELIO_JWT_TIMEOUT') || '1h'
        },
        (err, token) => {
          if (err) {
            console.log(err)
            req.Log.error(err)
            return res.status(400).json({ error: 'An error occurred authenticating your account' })
          }

          const whitelist = new this.models.TokenWhitelist({ token })
          whitelist.save()
          res.set('X-AuthToken', token).json({ token })
        })
      })
      .catch(err => next(err))
  }

  getAllSettings (req, res, next) {
    this.subModels.User.findOne({ id: req.user.id })
      .then(user => {
        res.json({ settings: user.settings })
      })
      .catch(err => next(err))
  }

  getSetting (req, res, next) {
    this.subModels.User.findOne({ id: req.user.id })
      .then(user => {
        res.json({ key: req.params.key, value: user.settings[req.params.key] || null })
      })
      .catch(err => next(err))
  }

  setSetting (req, res, next) {
    this.subModels.User.findOne({ id: req.user.id })
      .then(user => {
        user.settings[req.params.key] = req.body.value
        user.save(err => {
          if (err) return next(err)
          res.json({ message: 'Setting updated' })
        })
      })
      .catch(err => next(err))
  }

  getClientSettings (req, res, next) {
    this.subModels.User.findOne({ id: req.user.id }).select('clientSettings')
      .then(user => {
        res.json(user.clientSettings)
      })
      .catch(err => next(err))
  }

  setClientSettings (req, res, next) {
    this.subModels.User.findOne({ id: req.user.id }).select('clientSettings')
      .then(user => {
        // Block unreasonable client setting size
        if (Object.prototype.toString.call(req.body) !== '[object Object]') return res.status(400).json({ error: 'Client Settings must be an object' })
        if (Object.keys(req.body).length > 1024) return res.status(400).json({ error: 'Client Settings are too large' })

        user.clientSettings = req.body
        user.save(err => {
          if (err) return next(err)
          res.json({ message: 'Client Settings updated' })
        })
      })
      .catch(err => next(err))
  }

  getProfile (req, res, next) {
    this.subModels.User.findOne({ id: req.user.id })
      .then(user => {
        res.json({ profile: user.profile })
      })
      .catch(err => next(err))
  }

  getProfileItem (req, res, next) {
    this.subModels.User.findOne({ id: req.user.id })
      .then(user => {
        res.json({ key: req.params.key, value: user.profile[req.params.key] || null })
      })
      .catch(err => next(err))
  }

  setProfileItem (req, res, next) {
    this.subModels.User.findOne({ id: req.user.id })
      .then(user => {
        user.profile[req.params.key] = req.body.value
        user.save(err => {
          if (err) return next(err)
          res.json({ message: 'Profile updated' })
        })
      })
      .catch(err => next(err))
  }

  getUsername (req, res, next) {
    this.subModels.User.findOne({ id: req.user.id }).select('username')
      .then(user => {
        res.json(user.username)
      })
      .catch(err => next(err))
  }

  checkUsernameAvailability (req, res, next) {
    this.subModels.User.countDocuments({ username: req.body.username })
      .then(count => {
        if (count !== 0) return res.status(406).json({ error: 'Username is unavailable' })
        return res.json({ message: 'Username is available' })
      })
      .catch(err => next(err))
  }

  setUsername (req, res, next) {
    this.subModels.User.countDocuments({ username: req.body.username })
      .then(count => {
        if (count !== 0) return res.status(406).json({ error: 'Username is unavailable' })
        this.subModels.User.findOneAndUpdate({ id: req.user.id }, { username: req.body.username })
          .then(user => {
            return res.json({ message: 'Username updated successfully' })
          })
          .catch(err => next(err))
      })
      .catch(err => next(err))
  }

  updatePassword (req, res, next) {
    const { currentPassword, newPassword, confirmPassword } = req.body

    this.subModels.User.findOne({ id: req.user.id })
      .then(user => {
        if (user.validPassword(currentPassword)) {
          if (newPassword === confirmPassword) {
            bcrypt.hash(newPassword, 10, (err, hash) => {
              if (err) {
                req.Log.error(err)
                return res.status(500).json({ error: 'Error hashing your password' })
              }

              user.password = hash
              user.save(err => {
                if (err) return res.status(500).json({ error: 'There was an error saving your new password' })
                return res.json({ message: 'Your password has been updated!' })
              })
            })
          } else {
            return res.status(400).json({ error: 'New passwords did not match' })
          }
        } else {
          return res.status(400).json({ error: 'Current password is invalid' })
        }
      })
      .catch(err => next(err))
  }
}
