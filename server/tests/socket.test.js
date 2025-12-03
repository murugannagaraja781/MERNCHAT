const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let io, serverSocket, clientSocket, mongoServer, httpServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  httpServer = createServer();
  io = new Server(httpServer);

  httpServer.listen(() => {
    const port = httpServer.address().port;
    clientSocket = new Client(`http://localhost:${port}`);

    io.on('connection', (socket) => {
      serverSocket = socket;
    });
  });

  await new Promise((resolve) => {
    clientSocket.on('connect', resolve);
  });
});

afterAll(async () => {
  io.close();
  clientSocket.close();
  await mongoose.disconnect();
  await mongoServer.stop();
  httpServer.close();
});

describe('Socket.IO Events', () => {
  it('should connect client to server', () => {
    expect(clientSocket.connected).toBe(true);
  });

  it('should emit and receive join-room event', (done) => {
    const roomData = { roomId: 'test-room', userName: 'TestUser' };

    serverSocket.on('join-room', (data) => {
      expect(data.roomId).toBe(roomData.roomId);
      expect(data.userName).toBe(roomData.userName);
      done();
    });

    clientSocket.emit('join-room', roomData);
  });

  it('should emit and receive offer event', (done) => {
    const offerData = {
      offer: { type: 'offer', sdp: 'test-sdp' },
      to: 'peer-id',
      from: 'sender-id',
      userName: 'TestUser'
    };

    serverSocket.on('offer', (data) => {
      expect(data.offer).toEqual(offerData.offer);
      expect(data.to).toBe(offerData.to);
      done();
    });

    clientSocket.emit('offer', offerData);
  });

  it('should emit and receive answer event', (done) => {
    const answerData = {
      answer: { type: 'answer', sdp: 'test-sdp' },
      to: 'peer-id'
    };

    serverSocket.on('answer', (data) => {
      expect(data.answer).toEqual(answerData.answer);
      expect(data.to).toBe(answerData.to);
      done();
    });

    clientSocket.emit('answer', answerData);
  });

  it('should emit and receive ice-candidate event', (done) => {
    const candidateData = {
      candidate: { candidate: 'test-candidate' },
      to: 'peer-id'
    };

    serverSocket.on('ice-candidate', (data) => {
      expect(data.candidate).toEqual(candidateData.candidate);
      expect(data.to).toBe(candidateData.to);
      done();
    });

    clientSocket.emit('ice-candidate', candidateData);
  });

  it('should emit and receive chat-message event', (done) => {
    const messageData = {
      roomId: 'test-room',
      message: 'Hello World',
      userName: 'TestUser'
    };

    serverSocket.on('chat-message', (data) => {
      expect(data.message).toBe(messageData.message);
      expect(data.userName).toBe(messageData.userName);
      done();
    });

    clientSocket.emit('chat-message', messageData);
  });

  it('should emit and receive raise-hand event', (done) => {
    const handData = {
      roomId: 'test-room',
      userName: 'TestUser'
    };

    serverSocket.on('raise-hand', (data) => {
      expect(data.userName).toBe(handData.userName);
      done();
    });

    clientSocket.emit('raise-hand', handData);
  });

  it('should emit and receive toggle-audio event', (done) => {
    const audioData = {
      roomId: 'test-room',
      enabled: false
    };

    serverSocket.on('toggle-audio', (data) => {
      expect(data.enabled).toBe(audioData.enabled);
      done();
    });

    clientSocket.emit('toggle-audio', audioData);
  });

  it('should emit and receive toggle-video event', (done) => {
    const videoData = {
      roomId: 'test-room',
      enabled: true
    };

    serverSocket.on('toggle-video', (data) => {
      expect(data.enabled).toBe(videoData.enabled);
      done();
    });

    clientSocket.emit('toggle-video', videoData);
  });

  it('should emit and receive leave-room event', (done) => {
    const leaveData = { roomId: 'test-room' };

    serverSocket.on('leave-room', (data) => {
      expect(data.roomId).toBe(leaveData.roomId);
      done();
    });

    clientSocket.emit('leave-room', leaveData);
  });
});
