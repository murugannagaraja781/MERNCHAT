import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Home from './Home';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

global.fetch = jest.fn();

describe('Home Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  const renderHome = () => {
    return render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );
  };

  it('should render home page with title', () => {
    renderHome();
    expect(screen.getByText('WebRTC Video Call')).toBeInTheDocument();
    expect(screen.getByText('Connect with anyone, anywhere')).toBeInTheDocument();
  });

  it('should render input fields and buttons', () => {
    renderHome();
    expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter room ID')).toBeInTheDocument();
    expect(screen.getByText('Create New Room')).toBeInTheDocument();
    expect(screen.getByText('Join Room')).toBeInTheDocument();
  });

  it('should update name input value', () => {
    renderHome();
    const nameInput = screen.getByPlaceholderText('Enter your name');
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    expect(nameInput.value).toBe('John Doe');
  });

  it('should update room ID input value', () => {
    renderHome();
    const roomInput = screen.getByPlaceholderText('Enter room ID');
    fireEvent.change(roomInput, { target: { value: 'test-room-123' } });
    expect(roomInput.value).toBe('test-room-123');
  });

  it('should show alert when creating room without name', () => {
    window.alert = jest.fn();
    renderHome();

    const createButton = screen.getByText('Create New Room');
    fireEvent.click(createButton);

    expect(window.alert).toHaveBeenCalledWith('Please enter your name');
  });

  it('should create room and navigate when name is provided', async () => {
    const mockRoomId = 'test-room-123';
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ roomId: mockRoomId })
    });

    renderHome();

    const nameInput = screen.getByPlaceholderText('Enter your name');
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });

    const createButton = screen.getByText('Create New Room');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(localStorage.getItem('userName')).toBe('John Doe');
      expect(mockNavigate).toHaveBeenCalledWith(`/room/${mockRoomId}`);
    });
  });

  it('should show alert when joining room without name', () => {
    window.alert = jest.fn();
    renderHome();

    const joinButton = screen.getByText('Join Room');
    fireEvent.click(joinButton);

    expect(window.alert).toHaveBeenCalledWith('Please enter your name');
  });

  it('should show alert when joining room without room ID', () => {
    window.alert = jest.fn();
    renderHome();

    const nameInput = screen.getByPlaceholderText('Enter your name');
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });

    const joinButton = screen.getByText('Join Room');
    fireEvent.click(joinButton);

    expect(window.alert).toHaveBeenCalledWith('Please enter room ID');
  });

  it('should join room and navigate when valid inputs provided', async () => {
    const mockRoomId = 'test-room-123';
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ roomId: mockRoomId, exists: true })
    });

    renderHome();

    const nameInput = screen.getByPlaceholderText('Enter your name');
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });

    const roomInput = screen.getByPlaceholderText('Enter room ID');
    fireEvent.change(roomInput, { target: { value: mockRoomId } });

    const joinButton = screen.getByText('Join Room');
    fireEvent.click(joinButton);

    await waitFor(() => {
      expect(localStorage.getItem('userName')).toBe('John Doe');
      expect(mockNavigate).toHaveBeenCalledWith(`/room/${mockRoomId}`);
    });
  });

  it('should show alert when room not found', async () => {
    window.alert = jest.fn();
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404
    });

    renderHome();

    const nameInput = screen.getByPlaceholderText('Enter your name');
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });

    const roomInput = screen.getByPlaceholderText('Enter room ID');
    fireEvent.change(roomInput, { target: { value: 'invalid-room' } });

    const joinButton = screen.getByText('Join Room');
    fireEvent.click(joinButton);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Room not found');
    });
  });

  it('should handle create room API error', async () => {
    window.alert = jest.fn();
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    renderHome();

    const nameInput = screen.getByPlaceholderText('Enter your name');
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });

    const createButton = screen.getByText('Create New Room');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to create room');
    });
  });

  it('should disable buttons while loading', async () => {
    global.fetch.mockImplementationOnce(() => new Promise(() => {}));

    renderHome();

    const nameInput = screen.getByPlaceholderText('Enter your name');
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });

    const createButton = screen.getByText('Create New Room');
    fireEvent.click(createButton);

    expect(createButton).toBeDisabled();
    expect(screen.getByText('Join Room')).toBeDisabled();
  });
});
