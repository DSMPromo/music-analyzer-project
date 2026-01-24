import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AudioInputManager from '../../components/audio/AudioInputManager';

// Mock hooks
jest.mock('../../hooks/useAudioRecording', () => ({
  useAudioRecording: () => ({
    devices: [
      { deviceId: 'device1', label: 'Built-in Microphone' },
      { deviceId: 'device2', label: 'Mix M1 USB Audio' },
    ],
    selectedDevice: 'device1',
    setSelectedDevice: jest.fn(),
    isRecording: false,
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    duration: 0,
    getDevices: jest.fn(),
  }),
}));

describe('AudioInputManager', () => {
  const mockOnAudioReady = jest.fn();
  const mockOnStreamReady = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all input source options', () => {
    render(
      <AudioInputManager
        onAudioReady={mockOnAudioReady}
        onStreamReady={mockOnStreamReady}
      />
    );

    expect(screen.getByText(/upload/i)).toBeInTheDocument();
    expect(screen.getByText(/youtube/i)).toBeInTheDocument();
    expect(screen.getByText(/record/i)).toBeInTheDocument();
  });

  it('should show file upload zone', () => {
    render(
      <AudioInputManager
        onAudioReady={mockOnAudioReady}
        onStreamReady={mockOnStreamReady}
      />
    );

    expect(screen.getByText(/drag.*drop|browse/i)).toBeInTheDocument();
  });

  it('should accept audio file types', () => {
    render(
      <AudioInputManager
        onAudioReady={mockOnAudioReady}
        onStreamReady={mockOnStreamReady}
      />
    );

    const fileInput = screen.getByTestId('file-input');
    expect(fileInput).toHaveAttribute('accept', expect.stringContaining('audio'));
  });

  it('should handle file upload', async () => {
    render(
      <AudioInputManager
        onAudioReady={mockOnAudioReady}
        onStreamReady={mockOnStreamReady}
      />
    );

    const file = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });
    const fileInput = screen.getByTestId('file-input');

    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(mockOnAudioReady).toHaveBeenCalled();
    });
  });

  it('should show YouTube URL input', () => {
    render(
      <AudioInputManager
        onAudioReady={mockOnAudioReady}
        onStreamReady={mockOnStreamReady}
      />
    );

    const youtubeTab = screen.getByText(/youtube/i);
    fireEvent.click(youtubeTab);

    expect(screen.getByPlaceholderText(/youtube.*url/i)).toBeInTheDocument();
  });

  it('should validate YouTube URL format', async () => {
    render(
      <AudioInputManager
        onAudioReady={mockOnAudioReady}
        onStreamReady={mockOnStreamReady}
      />
    );

    const youtubeTab = screen.getByText(/youtube/i);
    fireEvent.click(youtubeTab);

    const input = screen.getByPlaceholderText(/youtube.*url/i);
    await userEvent.type(input, 'not-a-valid-url');

    const submitButton = screen.getByRole('button', { name: /extract|load/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid.*url/i)).toBeInTheDocument();
    });
  });

  it('should show device selector for recording', () => {
    render(
      <AudioInputManager
        onAudioReady={mockOnAudioReady}
        onStreamReady={mockOnStreamReady}
      />
    );

    const recordTab = screen.getByText(/record/i);
    fireEvent.click(recordTab);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should show recording controls', () => {
    render(
      <AudioInputManager
        onAudioReady={mockOnAudioReady}
        onStreamReady={mockOnStreamReady}
      />
    );

    const recordTab = screen.getByText(/record/i);
    fireEvent.click(recordTab);

    expect(screen.getByRole('button', { name: /start|record/i })).toBeInTheDocument();
  });

  it('should display loading state during YouTube extraction', async () => {
    global.fetch = jest.fn(() =>
      new Promise(resolve => setTimeout(() => resolve({ ok: true, json: () => ({}) }), 100))
    );

    render(
      <AudioInputManager
        onAudioReady={mockOnAudioReady}
        onStreamReady={mockOnStreamReady}
      />
    );

    const youtubeTab = screen.getByText(/youtube/i);
    fireEvent.click(youtubeTab);

    const input = screen.getByPlaceholderText(/youtube.*url/i);
    await userEvent.type(input, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    const submitButton = screen.getByRole('button', { name: /extract|load/i });
    fireEvent.click(submitButton);

    expect(screen.getByText(/loading|extracting/i)).toBeInTheDocument();
  });

  it('should display file name after upload', async () => {
    render(
      <AudioInputManager
        onAudioReady={mockOnAudioReady}
        onStreamReady={mockOnStreamReady}
      />
    );

    const file = new File(['audio data'], 'my-song.mp3', { type: 'audio/mpeg' });
    const fileInput = screen.getByTestId('file-input');

    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText(/my-song\.mp3/i)).toBeInTheDocument();
    });
  });
});
