import '@testing-library/jest-dom';

// Mock WebRTC APIs
global.RTCPeerConnection = jest.fn().mockImplementation(() => ({
  createOffer: jest.fn(),
  createAnswer: jest.fn(),
  setLocalDescription: jest.fn(),
  setRemoteDescription: jest.fn(),
  addIceCandidate: jest.fn(),
  addTrack: jest.fn(),
  getSenders: jest.fn(() => []),
  close: jest.fn(),
  onicecandidate: null,
  ontrack: null,
  onconnectionstatechange: null,
  connectionState: 'connected'
}));

global.RTCSessionDescription = jest.fn();
global.RTCIceCandidate = jest.fn();

// Mock getUserMedia
global.navigator.mediaDevices = {
  getUserMedia: jest.fn(() =>
    Promise.resolve({
      getTracks: () => [],
      getAudioTracks: () => [{ enabled: true }],
      getVideoTracks: () => [{ enabled: true }]
    })
  ),
  getDisplayMedia: jest.fn(() =>
    Promise.resolve({
      getTracks: () => [],
      getVideoTracks: () => [{ enabled: true, onended: null }]
    })
  )
};

// Mock clipboard
global.navigator.clipboard = {
  writeText: jest.fn(() => Promise.resolve())
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock window.alert
global.alert = jest.fn();
