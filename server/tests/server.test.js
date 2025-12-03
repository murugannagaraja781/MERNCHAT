const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;
let server;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  process.env.MONGODB_URI = mongoUri;
  process.env.CLIENT_URL = 'http://localhost:3000';
  process.env.PORT = 5001;

  await mongoose.connect(mongoUri);

  // Import after env vars are set
  const express = require('express');
  const http = require('http');
  const cors = require('cors');

  app = express();
  app.use(cors());
  app.use(express.json());

  const Room = require('../models/Room');
  const { v4: uuidv4 } = require('uuid');

  app.post('/api/room/create', async (req, res) => {
    try {
      const roomId = uuidv4();
      const room = new Room({ roomId });
      await room.save();
      res.json({ roomId, url: `http://localhost:3000/room/${roomId}` });
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

  server = http.createServer(app);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  if (server) {
    server.close();
  }
});

describe('Room API Endpoints', () => {
  describe('POST /api/room/create', () => {
    it('should create a new room with UUID', async () => {
      const response = await request(app)
        .post('/api/room/create')
        .expect(200);

      expect(response.body).toHaveProperty('roomId');
      expect(response.body).toHaveProperty('url');
      expect(response.body.roomId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should return unique room IDs for multiple requests', async () => {
      const response1 = await request(app).post('/api/room/create');
      const response2 = await request(app).post('/api/room/create');

      expect(response1.body.roomId).not.toBe(response2.body.roomId);
    });
  });

  describe('GET /api/room/:id/join', () => {
    it('should return room info for existing room', async () => {
      const createResponse = await request(app).post('/api/room/create');
      const roomId = createResponse.body.roomId;

      const response = await request(app)
        .get(`/api/room/${roomId}/join`)
        .expect(200);

      expect(response.body.roomId).toBe(roomId);
      expect(response.body.exists).toBe(true);
    });

    it('should return 404 for non-existent room', async () => {
      const fakeRoomId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .get(`/api/room/${fakeRoomId}/join`)
        .expect(404);

      expect(response.body.error).toBe('Room not found');
    });
  });
});

describe('Room Model', () => {
  const Room = require('../models/Room');

  it('should create a room with required fields', async () => {
    const roomData = {
      roomId: 'test-room-123',
      active: true
    };

    const room = new Room(roomData);
    const savedRoom = await room.save();

    expect(savedRoom.roomId).toBe(roomData.roomId);
    expect(savedRoom.active).toBe(true);
    expect(savedRoom.createdAt).toBeDefined();
  });

  it('should fail without roomId', async () => {
    const room = new Room({});

    await expect(room.save()).rejects.toThrow();
  });

  it('should add participants to room', async () => {
    const room = new Room({ roomId: 'test-room-456' });
    room.participants.push({
      socketId: 'socket-123',
      joinedAt: new Date()
    });

    const savedRoom = await room.save();

    expect(savedRoom.participants).toHaveLength(1);
    expect(savedRoom.participants[0].socketId).toBe('socket-123');
  });
});
