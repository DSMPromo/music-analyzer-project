// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Polyfill TextEncoder/TextDecoder for jsPDF in tests
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock WaveSurfer.js
jest.mock('wavesurfer.js', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      loadBlob: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(),
      getCurrentTime: jest.fn(() => 0),
      getDuration: jest.fn(() => 0),
      registerPlugin: jest.fn(() => ({
        addRegion: jest.fn(),
        clearRegions: jest.fn(),
        on: jest.fn(),
      })),
    })),
  },
}));

jest.mock('wavesurfer.js/dist/plugins/regions.js', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      addRegion: jest.fn(),
      clearRegions: jest.fn(),
      enableDragSelection: jest.fn(),
      on: jest.fn(),
    })),
  },
}));

// Mock jsPDF to avoid complex setup
jest.mock('jspdf', () => ({
  jsPDF: jest.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
    setFontSize: jest.fn(),
    setTextColor: jest.fn(),
    setFillColor: jest.fn(),
    setDrawColor: jest.fn(),
    text: jest.fn(),
    rect: jest.fn(),
    line: jest.fn(),
    save: jest.fn(),
  })),
}));
