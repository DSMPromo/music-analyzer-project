import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MIDIGenerator from '../../components/MIDIGenerator';

// Mock fetch
global.fetch = jest.fn();

describe('MIDIGenerator', () => {
  const mockAudioFile = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
  const mockOnMIDIGenerated = jest.fn();

  const defaultProps = {
    audioFile: mockAudioFile,
    onMIDIGenerated: mockOnMIDIGenerated,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        midiPath: '/temp/test.mid',
        notes: 42,
        events: [],
      }),
      blob: () => Promise.resolve(new Blob(['midi data'], { type: 'audio/midi' })),
    });
  });

  it('should render generate button', () => {
    render(<MIDIGenerator {...defaultProps} />);

    expect(screen.getByRole('button', { name: /generate midi/i })).toBeInTheDocument();
  });

  it('should show options panel', () => {
    render(<MIDIGenerator {...defaultProps} />);

    expect(screen.getByText(/onset threshold/i)).toBeInTheDocument();
    expect(screen.getByText(/frame threshold/i)).toBeInTheDocument();
  });

  it('should allow adjusting onset threshold', () => {
    render(<MIDIGenerator {...defaultProps} />);

    const slider = screen.getByLabelText(/onset threshold/i);
    fireEvent.change(slider, { target: { value: '0.7' } });

    expect(slider).toHaveValue('0.7');
  });

  it('should allow adjusting frame threshold', () => {
    render(<MIDIGenerator {...defaultProps} />);

    const slider = screen.getByLabelText(/frame threshold/i);
    fireEvent.change(slider, { target: { value: '0.4' } });

    expect(slider).toHaveValue('0.4');
  });

  it('should show min note length option', () => {
    render(<MIDIGenerator {...defaultProps} />);

    expect(screen.getByLabelText(/min.*note.*length/i)).toBeInTheDocument();
  });

  it('should disable generate button when no file', () => {
    render(<MIDIGenerator {...defaultProps} audioFile={null} />);

    const button = screen.getByRole('button', { name: /generate midi/i });
    expect(button).toBeDisabled();
  });

  it('should show loading state during generation', async () => {
    global.fetch.mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      }), 100))
    );

    render(<MIDIGenerator {...defaultProps} />);

    const button = screen.getByRole('button', { name: /generate midi/i });
    fireEvent.click(button);

    expect(screen.getByText(/generating|processing/i)).toBeInTheDocument();
  });

  it('should call API with correct parameters', async () => {
    render(<MIDIGenerator {...defaultProps} />);

    const button = screen.getByRole('button', { name: /generate midi/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/midi/generate'),
        expect.any(Object)
      );
    });
  });

  it('should display note count after generation', async () => {
    render(<MIDIGenerator {...defaultProps} />);

    const button = screen.getByRole('button', { name: /generate midi/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/42.*notes/i)).toBeInTheDocument();
    });
  });

  it('should show download button after generation', async () => {
    render(<MIDIGenerator {...defaultProps} />);

    const button = screen.getByRole('button', { name: /generate midi/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
    });
  });

  it('should handle API errors', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    render(<MIDIGenerator {...defaultProps} />);

    const button = screen.getByRole('button', { name: /generate midi/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/error|failed/i)).toBeInTheDocument();
    });
  });

  it('should call onMIDIGenerated callback', async () => {
    render(<MIDIGenerator {...defaultProps} />);

    const button = screen.getByRole('button', { name: /generate midi/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnMIDIGenerated).toHaveBeenCalled();
    });
  });

  it('should show frequency filter options', () => {
    render(<MIDIGenerator {...defaultProps} showAdvancedOptions={true} />);

    expect(screen.getByLabelText(/min.*freq/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/max.*freq/i)).toBeInTheDocument();
  });
});
