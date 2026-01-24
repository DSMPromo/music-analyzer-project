import React, { useState, useRef } from 'react';
import { useAudioRecording } from '../../hooks/useAudioRecording';

function AudioInputManager({ onAudioReady, onStreamReady }) {
  const [activeTab, setActiveTab] = useState('upload');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const fileInputRef = useRef(null);

  const {
    devices,
    selectedDevice,
    setSelectedDevice,
    isRecording,
    startRecording,
    stopRecording,
    duration,
  } = useAudioRecording();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(file);
      if (onAudioReady) {
        onAudioReady(file);
      }
    }
  };

  const validateYoutubeUrl = (url) => {
    const patterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
    ];
    return patterns.some((pattern) => pattern.test(url));
  };

  const handleYoutubeExtract = async () => {
    if (!validateYoutubeUrl(youtubeUrl)) {
      setUrlError('Invalid YouTube URL');
      return;
    }

    setUrlError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/youtube/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      if (!response.ok) {
        throw new Error('Extraction failed');
      }

      const data = await response.json();
      if (onAudioReady) {
        onAudioReady(data);
      }
    } catch (err) {
      setUrlError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartRecording = async () => {
    await startRecording(selectedDevice);
    if (onStreamReady) {
      onStreamReady();
    }
  };

  return (
    <div className="audio-input-manager">
      <div className="tabs" role="tablist">
        <button
          role="tab"
          className={activeTab === 'upload' ? 'active' : ''}
          onClick={() => setActiveTab('upload')}
          aria-selected={activeTab === 'upload'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload
        </button>
        <button
          role="tab"
          className={activeTab === 'youtube' ? 'active' : ''}
          onClick={() => setActiveTab('youtube')}
          aria-selected={activeTab === 'youtube'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
          </svg>
          YouTube
        </button>
        <button
          role="tab"
          className={activeTab === 'record' ? 'active' : ''}
          onClick={() => setActiveTab('record')}
          aria-selected={activeTab === 'record'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
          Record
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'upload' && (
          <div className="upload-zone">
            <div className="upload-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p className="upload-title">Drop your audio file here</p>
            <p className="upload-subtitle">or click to browse</p>
            <p className="upload-formats">Supports MP3, WAV, FLAC, OGG, M4A</p>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              data-testid="file-input"
            />
            {uploadedFile && (
              <div className="file-selected">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13"/>
                  <circle cx="6" cy="18" r="3"/>
                  <circle cx="18" cy="16" r="3"/>
                </svg>
                {uploadedFile.name}
              </div>
            )}
          </div>
        )}

        {activeTab === 'youtube' && (
          <div className="youtube-input">
            <input
              type="text"
              placeholder="Enter YouTube URL"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
            <button onClick={handleYoutubeExtract} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Extract'}
            </button>
            {urlError && <p className="error">{urlError}</p>}
          </div>
        )}

        {activeTab === 'record' && (
          <div className="record-controls">
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
            >
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>

            {!isRecording ? (
              <button onClick={handleStartRecording}>Start Recording</button>
            ) : (
              <button onClick={stopRecording}>Stop Recording</button>
            )}

            {isRecording && <p>Recording... {duration}s</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default AudioInputManager;
