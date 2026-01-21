import { render, screen } from '@testing-library/react';
import App from './App';

test('renders music analyzer header', () => {
  render(<App />);
  const headerElement = screen.getByRole('heading', { name: /music analyzer/i });
  expect(headerElement).toBeInTheDocument();
});

test('renders audio input manager', () => {
  render(<App />);
  const uploadTab = screen.getByRole('tab', { name: /upload/i });
  expect(uploadTab).toBeInTheDocument();
});
