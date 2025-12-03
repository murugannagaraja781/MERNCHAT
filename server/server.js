const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const Room = require('./models/Room');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: 'https://affectionate-benevolence-production-220f.up.railway.app',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect('mongodb+srv://username:password@cluster.mongodb.net/aichat')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB error:', err));

// REST API Routes
app.post('/api/room/create', async (req, res) => {
  try {
    const roomId = uuidv4();
    const room = new Room({ roomId });
    await room.save();
    res.json({ roomId, url: `${process.env.CLIENT_URL}/room/${roomId}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create room' });
  }
});

app.get('/api/room/:id/join', async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.id, active: true });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json({ roomId: room.roomId, exists: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Socket.IO signaling
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', async ({ roomId, userName }) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }

    const roomUsers = rooms.get(roomId);
    roomUsers.set(socket.id, { userName, socketId: socket.id });

    // Update MongoDB
    try {
      await Room.findOneAndUpdate(
        { roomId },
        {
          $push: {
            participants: {
              socketId: socket.id,
              joinedAt: new Date()
            }
          }
        }
      );
    } catch (error) {
      console.error('DB update error:', error);
    }

    // Get all users in room except sender
    const otherUsers = Array.from(roomUsers.values()).filter(u => u.socketId !== socket.id);

    // Send existing users to new user
    socket.emit('all-users', otherUsers);

    // Notify others about new user
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      userName
    });

    console.log(`${userName} joined room ${roomId}`);
  });

  socket.on('offer', ({ offer, to, from, userName }) => {
    io.to(to).emit('offer', { offer, from, userName });
  });

  socket.on('answer', ({ answer, to }) => {
    io.to(to).emit('answer', { answer, from: socket.id });
  });

  socket.on('ice-candidate', ({ candidate, to }) => {
    io.to(to).emit('ice-candidate', { candidate, from: socket.id });
  });

  socket.on('chat-message', ({ roomId, message, userName }) => {
    io.to(roomId).emit('chat-message', {
      message,
      userName,
      socketId: socket.id,
      timestamp: new Date()
    });
  });

  socket.on('raise-hand', ({ roomId, userName }) => {
    socket.to(roomId).emit('hand-raised', {
      socketId: socket.id,
      userName
    });
  });

  socket.on('toggle-audio', ({ roomId, enabled }) => {
    socket.to(roomId).emit('user-audio-toggle', {
      socketId: socket.id,
      enabled
    });
  });

  socket.on('toggle-video', ({ roomId, enabled }) => {
    socket.to(roomId).emit('user-video-toggle', {
      socketId: socket.id,
      enabled
    });
  });

  socket.on('leave-room', async ({ roomId }) => {
    await handleUserLeave(socket, roomId);
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);

    // Find and leave all rooms
    for (const [roomId, users] of rooms.entries()) {
      if (users.has(socket.id)) {
        await handleUserLeave(socket, roomId);
      }
    }
  });

  async function handleUserLeave(socket, roomId) {
    const roomUsers = rooms.get(roomId);
    if (roomUsers) {
      const user = roomUsers.get(socket.id);
      roomUsers.delete(socket.id);

      if (roomUsers.size === 0) {
        rooms.delete(roomId);
        // Mark room as inactive
        try {
          await Room.findOneAndUpdate({ roomId }, { active: false });
        } catch (error) {
          console.error('DB update error:', error);
        }
      }

      socket.to(roomId).emit('user-left', {
        socketId: socket.id,
        userName: user?.userName
      });
    }

    socket.leave(roomId);
  }
});

const PORT = process.env.PORT || 7009;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
