const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  participants: [{
    socketId: String,
    joinedAt: Date,
    leftAt: Date
  }],
  active: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.model('Room', roomSchema);
