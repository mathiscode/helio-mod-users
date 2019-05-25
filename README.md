# Helio API Boilerplate: Users Mod

Handles user registration, authentication, profile/setting management, and more.

This mod may be installed into projects utilizing [Helio API Boilerplate](https://github.com/mathiscode/helio-api-boilerplate).

---

- [Helio API Boilerplate: Users Mod](#helio-api-boilerplate-users-mod)
  - [Install](#install)
  - [Methods](#methods)
    - [`GET /`](#get)
    - [`POST /register` [public]](#post-register-public)
    - [`POST /login` [public]](#post-login-public)
    - [`GET /settings`](#get-settings)
    - [`GET /settings/:key`](#get-settingskey)
    - [`POST /settings/:key`](#post-settingskey)
    - [`GET /client-settings`](#get-client-settings)
    - [`POST /client-settings`](#post-client-settings)
    - [`GET /profile`](#get-profile)
    - [`GET /profile/:key`](#get-profilekey)
    - [`POST /profile/:key`](#post-profilekey)
    - [`GET /username`](#get-username)
    - [`GET /username/availability` [public]](#get-usernameavailability-public)
    - [`PATCH /username`](#patch-username)
    - [`PATCH /password`](#patch-password)

---

## Install

```sh
yarn add helio-mod-users # or npm install helio-mod-users
```

```js
import UsersMod from 'helio-mod-users'
Mods = [{ path: '/user', module: UsersMod }]
```

## Methods

### `GET /`

- Get user object of current user

### `POST /register` [public]

> { email: 'jdoe@example.com', password: 'supersecretpassword' }

- Register a new user; returns auth token

### `POST /login` [public]

> { email: 'jdoe@example.com', password: 'supersecretpassword' }

- Login as user; returns auth token

### `GET /settings`

- Get settings object of current user

### `GET /settings/:key`

- Get setting value with key name :key

### `POST /settings/:key`

> { value: 'NewValue' }

- Set value for setting with key name :key

### `GET /client-settings`

- Get client settings object; may be used by a frontend to store preferences

### `POST /client-settings`

> { any: 'thing', can: 'be', stored: 'here' }

- Update the client settings object; may be used by a frontend to store preferences

### `GET /profile`

- Get profile object of current user

### `GET /profile/:key`

- Get value for profile item with key name :key

### `POST /profile/:key`

> { value: 'NewValue' }

- Set value for profile item with key name :key

### `GET /username`

- Get username of current user

### `GET /username/availability` [public]

> { username: 'MyNewUsername' }

- Check availbility of username

### `PATCH /username`

> { username: 'MyNewUsername' }

- Change username of current user

### `PATCH /password`

> { currentPassword: 'mycurrentpassword', newPassword: 'mynewpass', confirmPassword: 'mynewpass' }

- Update password for current user
