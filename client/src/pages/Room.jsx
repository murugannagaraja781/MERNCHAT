import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import './Room.css';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:7009';

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add TURN servers here for production
    // { urls: 'turn:your-turn-server.com', username: 'user', credential: 'pass' }
  ]
};

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const userName = localStorage.getItem('userName') || 'Anonymous';

  const [peers, setPeers] = useState(new Map());
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [participants, setParticipants] = useState([]);

  const socketRef = useRef();
  const localVideoRef = useRef();
  const localStreamRef = useRef();
  const screenStreamRef = useRef();
  const peerConnectionsRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());

  useEffect(() => {
    if (!userName) {
      navigate('/');
      return;
    }

    initializeMedia();
    initializeSocket();

    return () => {
      cleanup();
    };
  }, []);

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Failed to access camera/microphone');
    }
  };

  const initializeSocket = () => {
    socketRef.current = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });

    socketRef.current.emit('join-room', { roomId, userName });

    socketRef.current.on('all-users', (users) => {
      users.forEach(user => {
        createPeerConnection(user.socketId, true, user.userName);
      });
      setParticipants(prev => [...prev, ...users]);
    });

    socketRef.current.on('user-joined', ({ socketId, userName: newUserName }) => {
      setParticipants(prev => [...prev, { socketId, userName: newUserName }]);
      addMessage(`${newUserName} joined the room`, 'system');
    });

    socketRef.current.on('offer', async ({ offer, from, userName: senderName }) => {
      const pc = createPeerConnection(from, false, senderName);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current.emit('answer', { answer, to: from });
    });

    socketRef.current.on('answer', async ({ answer, from }) => {
      const pc = peerConnectionsRef.current.get(from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socketRef.current.on('ice-candidate', async ({ candidate, from }) => {
      const pc = peerConnectionsRef.current.get(from);
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socketRef.current.on('user-left', ({ socketId, userName: leftUserName }) => {
      removePeer(socketId);
      setParticipants(prev => prev.filter(p => p.socketId !== socketId));
      addMessage(`${leftUserName || 'User'} left the room`, 'system');
    });

    socketRef.current.on('chat-message', ({ message, userName: senderName, socketId, timestamp }) => {
      addMessage(message, 'user', senderName, socketId);
    });

    socketRef.current.on('hand-raised', ({ socketId, userName: raiserName }) => {
      addMessage(`${raiserName} raised hand`, 'system');
    });

    socketRef.current.on('user-audio-toggle', ({ socketId, enabled }) => {
      setPeers(prev => {
        const newPeers = new Map(prev);
        const peer = newPeers.get(socketId);
        if (peer) {
          newPeers.set(socketId, { ...peer, audioEnabled: enabled });
        }
        return newPeers;
      });
    });

    socketRef.current.on('user-video-toggle', ({ socketId, enabled }) => {
      setPeers(prev => {
        const newPeers = new Map(prev);
        const peer = newPeers.get(socketId);
        if (peer) {
          newPeers.set(socketId, { ...peer, videoEnabled: enabled });
        }
        return newPeers;
      });
    });

    socketRef.current.on('reconnect', () => {
      console.log('Reconnected to server');
      socketRef.current.emit('join-room', { roomId, userName });
    });
  };

  const createPeerConnection = (socketId, isInitiator, peerUserName) => {
    if (peerConnectionsRef.current.has(socketId)) {
      return peerConnectionsRef.current.get(socketId);
    }

    const pc = new RTCPeerConnection(iceServers);

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          to: socketId
        });
      }
    };

    // Handle remote tracks
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      remoteStreamsRef.current.set(socketId, remoteStream);

      setPeers(prev => {
        const newPeers = new Map(prev);
        newPeers.set(socketId, {
          stream: remoteStream,
          userName: peerUserName,
          socketId,
          audioEnabled: true,
          videoEnabled: true
        });
        return newPeers;
      });
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.log('Connection failed, attempting to reconnect...');
        // Implement reconnection logic here
      }
    };

    peerConnectionsRef.current.set(socketId, pc);

    // Create offer if initiator
    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socketRef.current.emit('offer', {
            offer: pc.localDescription,
            to: socketId,
            from: socketRef.current.id,
            userName
          });
        })
        .catch(err => console.error('Error creating offer:', err));
    }

    return pc;
  };

  const removePeer = (socketId) => {
    const pc = peerConnectionsRef.current.get(socketId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(socketId);
    }
    remoteStreamsRef.current.delete(socketId);
    setPeers(prev => {
      const newPeers = new Map(prev);
      newPeers.delete(socketId);
      return newPeers;
    });
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        socketRef.current.emit('toggle-audio', { roomId, enabled: audioTrack.enabled });
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        socketRef.current.emit('toggle-video', { roomId, enabled: videoTrack.enabled });
      }
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }

      // Restore camera
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      peerConnectionsRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      setIsScreenSharing(false);
    } else {
      // Start screen sharing
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false
        });

        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Replace video track in all peer connections
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
      } catch (error) {
        console.error('Error sharing screen:', error);
      }
    }
  };

  const sendMessage = () => {
    if (chatInput.trim()) {
      socketRef.current.emit('chat-message', {
        roomId,
        message: chatInput,
        userName
      });
      addMessage(chatInput, 'user', userName, socketRef.current.id);
      setChatInput('');
    }
  };

  const raiseHand = () => {
    socketRef.current.emit('raise-hand', { roomId, userName });
    addMessage('You raised your hand', 'system');
  };

  const addMessage = (text, type, sender = '', senderId = '') => {
    setMessages(prev => [...prev, {
      text,
      type,
      sender,
      senderId,
      timestamp: new Date()
    }]);
  };

  const leaveRoom = () => {
    socketRef.current.emit('leave-room', { roomId });
    cleanup();
    navigate('/');
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    peerConnectionsRef.current.forEach(pc => pc.close());
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  const copyRoomLink = () => {
    const link = window.location.href;
    navigator.clipboard.writeText(link);
    alert('Room link copied to clipboard!');
  };

  return (
    <div className="room">
      <div className="room-header">
        <div className="room-info">
          <h2>Room: {roomId.substring(0, 8)}...</h2>
          <button onClick={copyRoomLink} className="copy-btn">Copy Link</button>
        </div>
        <div className="participant-count">
          {participants.length + 1} participant{participants.length !== 0 ? 's' : ''}
        </div>
      </div>

      <div className="video-grid">
        <div className="video-container local">
          <video ref={localVideoRef} autoPlay muted playsInline />
          <div className="video-label">{userName} (You)</div>
          {!isAudioEnabled && <div className="muted-indicator">🔇</div>}
          {!isVideoEnabled && <div className="video-off-overlay">Camera Off</div>}
        </div>

        {Array.from(peers.values()).map(peer => (
          <div key={peer.socketId} className="video-container">
            <video
              autoPlay
              playsInline
              ref={el => {
                if (el && peer.stream) {
                  el.srcObject = peer.stream;
                }
              }}
            />
            <div className="video-label">{peer.userName}</div>
            {!peer.audioEnabled && <div className="muted-indicator">🔇</div>}
            {!peer.videoEnabled && <div className="video-off-overlay">Camera Off</div>}
          </div>
        ))}
      </div>

      <div className="controls">
        <button
          onClick={toggleAudio}
          className={`control-btn ${!isAudioEnabled ? 'disabled' : ''}`}
          title={isAudioEnabled ? 'Mute' : 'Unmute'}
        >
          {isAudioEnabled ? '🎤' : '🔇'}
        </button>

        <button
          onClick={toggleVideo}
          className={`control-btn ${!isVideoEnabled ? 'disabled' : ''}`}
          title={isVideoEnabled ? 'Stop Video' : 'Start Video'}
        >
          {isVideoEnabled ? '📹' : '📷'}
        </button>

        <button
          onClick={toggleScreenShare}
          className={`control-btn ${isScreenSharing ? 'active' : ''}`}
          title="Share Screen"
        >
          🖥️
        </button>

        <button
          onClick={raiseHand}
          className="control-btn"
          title="Raise Hand"
        >
          ✋
        </button>

        <button
          onClick={() => setShowChat(!showChat)}
          className="control-btn"
          title="Chat"
        >
          💬
        </button>

        <button
          onClick={leaveRoom}
          className="control-btn leave-btn"
          title="Leave Room"
        >
          📞
        </button>
      </div>

      {showChat && (
        <div className="chat-panel">
          <div className="chat-header">
            <h3>Chat</h3>
            <button onClick={() => setShowChat(false)}>✕</button>
          </div>
          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.type}`}>
                {msg.type === 'user' && (
                  <strong>{msg.sender}: </strong>
                )}
                <span>{msg.text}</span>
              </div>
            ))}
          </div>
          <div className="chat-input">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Room;
