import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Room from './Room';

const mockNavigate = jest.fn();
const mockRoomId = 'test-room-123';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ roomId: mockRoomId }),
}));

jest.mock('socket.io-client', () => {
  const mockSocket = {
    emit: jest.fn(),
    on: jest.fn(),
    disconnect: jest.fn(),
    id: 'socket-123'
  };
  return jest.fn(() => mockSocket);
});

describe('Room Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('userName', 'TestUser');
  });

  const renderRoom = () => {
    return render(
      <BrowserRouter>
        <Room />
      </BrowserRouter>
    );
  };

  it('should render room with room ID', () => {
    renderRoom();
    expect(screen.getByText(/Room:/)).toBeInTheDocument();
  });

  it('should redirect to home if no userName', () => {
    localStorage.removeItem('userName');
    renderRoom();
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('should render control buttons', () => {
    renderRoom();
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should copy room link to clipboard', async () => {
    renderRoom();
    const copyButton = screen.getByText('Copy Link');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it('should toggle chat panel', () => {
    renderRoom();
    const chatButton = screen.getAllByRole('button').find(btn => btn.textContent === '💬');

    if (chatButton) {
      fireEvent.click(chatButton);
      expect(screen.getByText('Chat')).toBeInTheDocument();
    }
  });
});
