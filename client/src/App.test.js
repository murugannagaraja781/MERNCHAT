import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./pages/Home', () => {
  return function Home() {
    return <div>Home Page</div>;
  };
});

jest.mock('./pages/Room', () => {
  return function Room() {
    return <div>Room Page</div>;
  };
});

describe('App Component', () => {
  it('should render without crashing', () => {
    render(<App />);
  });

  it('should render home page on root route', () => {
    window.history.pushState({}, 'Home', '/');
    render(<App />);
    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });
});
