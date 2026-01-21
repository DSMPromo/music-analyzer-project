import React, { useState, useRef } from 'react';
import { useAudioRecording } from '../hooks/useAudioRecording';

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
          Upload
        </button>
        <button
          role="tab"
          className={activeTab === 'youtube' ? 'active' : ''}
          onClick={() => setActiveTab('youtube')}
          aria-selected={activeTab === 'youtube'}
        >
          YouTube
        </button>
        <button
          role="tab"
          className={activeTab === 'record' ? 'active' : ''}
          onClick={() => setActiveTab('record')}
          aria-selected={activeTab === 'record'}
        >
          Record
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'upload' && (
          <div className="upload-zone">
            <p>Drag & drop or browse files</p>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              data-testid="file-input"
            />
            {uploadedFile && <p>{uploadedFile.name}</p>}
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
