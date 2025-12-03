import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const API_URL ='https://mernchat-production-d169.up.railway.app'

function Home() {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const createRoom = async () => {
    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/room/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      localStorage.setItem('userName', userName);
      navigate(`/room/${data.roomId}`);
    } catch (error) {
      alert('Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }
    if (!roomId.trim()) {
      alert('Please enter room ID');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/room/${roomId}/join`);
      if (response.ok) {
        localStorage.setItem('userName', userName);
        navigate(`/room/${roomId}`);
      } else {
        alert('Room not found');
      }
    } catch (error) {
      alert('Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home">
      <div className="home-container">
        <h1>WebRTC Video Call</h1>
        <p className="subtitle">Connect with anyone, anywhere</p>

        <div className="input-group">
          <input
            type="text"
            placeholder="Enter your name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="input"
          />
        </div>

        <button
          onClick={createRoom}
          disabled={loading}
          className="btn btn-primary"
        >
          Create New Room
        </button>

        <div className="divider">
          <span>OR</span>
        </div>

        <div className="input-group">
          <input
            type="text"
            placeholder="Enter room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="input"
          />
        </div>

        <button
          onClick={joinRoom}
          disabled={loading}
          className="btn btn-secondary"
        >
          Join Room
        </button>
      </div>
    </div>
  );
}

export default Home;
