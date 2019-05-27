import mongoose from 'mongoose'

export default new mongoose.Schema({
  mod: String,

  profile: {
    phone: String
  },

  settings: {
    subscribeToNewsletter: { type: Boolean, default: true }
  }
})
