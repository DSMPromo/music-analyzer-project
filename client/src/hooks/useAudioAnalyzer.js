import { useState, useCallback, useRef } from 'react';
import {
  calculatePeak,
  calculateRMS,
  linearToDb,
  calculateCrestFactor,
  calculateDynamicRange,
  detectClipping,
  calculateDCOffset,
  estimateSNR,
  calculateStereoWidth,
  calculatePhaseCorrelation,
  calculateChannelBalance,
  analyzeFrequencyBands,
  calculateLUFS,
  calculateQualityScore,
  generateRecommendations,
  PLATFORM_TARGETS
} from '../utils/analysisUtils';

/**
 * Custom hook for comprehensive audio analysis
 * Provides loudness, frequency, stereo, and quality metrics
 */
export function useAudioAnalyzer() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [error, setError] = useState(null);
  const [targetPlatform, setTargetPlatform] = useState('spotify');
  const [audioBuffer, setAudioBuffer] = useState(null);

  const audioContextRef = useRef(null);
  const abortRef = useRef(false);

  /**
   * Analyze an audio file completely
   * @param {File} audioFile - Audio file to analyze
   * @returns {Object} Complete analysis results
   */
  const analyzeFile = useCallback(async (audioFile) => {
    if (!audioFile) {
      setError('No audio file provided');
      return null;
    }

    setIsAnalyzing(true);
    setProgress(0);
    setError(null);
    abortRef.current = false;

    try {
      // Create audio context for decoding
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 44100 });

      setProgress(10);

      // Read file as ArrayBuffer
      const arrayBuffer = await audioFile.arrayBuffer();

      if (abortRef.current) {
        throw new Error('Analysis cancelled');
      }

      setProgress(20);

      // Decode audio data (with automatic conversion for unsupported formats)
      let decodedBuffer;
      try {
        decodedBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer.slice(0));
      } catch (decodeError) {
        // Browser can't decode - try server-side conversion
        const { convertToWav, needsConversion } = await import('../utils/audioConversion');

        if (needsConversion(audioFile)) {
          console.log('Browser cannot decode, trying server-side conversion...');
          try {
            const result = await convertToWav(audioFile);
            const wavArrayBuffer = await result.file.arrayBuffer();
            decodedBuffer = await audioContextRef.current.decodeAudioData(wavArrayBuffer);
            console.log('Server-side conversion successful');
          } catch (conversionError) {
            console.error('Server conversion failed:', conversionError);
            const ext = audioFile.name.split('.').pop().toUpperCase();
            throw new Error(`Could not convert ${ext} file. Make sure the backend server is running (node server.js) and FFmpeg is installed.`);
          }
        } else {
          throw new Error(`Unable to decode audio data. The file may be corrupted or use an unsupported codec.`);
        }
      }

      // Store audioBuffer for spectrogram generation
      setAudioBuffer(decodedBuffer);

      if (abortRef.current) {
        throw new Error('Analysis cancelled');
      }

      setProgress(30);

      // Use local variable for rest of function
      const audioBuffer = decodedBuffer;

      // Extract basic info
      const sampleRate = audioBuffer.sampleRate;
      const numChannels = audioBuffer.numberOfChannels;
      const duration = audioBuffer.duration;

      // Get channel data
      const leftChannel = audioBuffer.getChannelData(0);
      const rightChannel = numChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;

      setProgress(40);

      // Merge channels for mono analysis
      const monoBuffer = new Float32Array(leftChannel.length);
      for (let i = 0; i < leftChannel.length; i++) {
        monoBuffer[i] = numChannels > 1
          ? (leftChannel[i] + rightChannel[i]) / 2
          : leftChannel[i];
      }

      if (abortRef.current) {
        throw new Error('Analysis cancelled');
      }

      // === LOUDNESS ANALYSIS ===
      setProgress(50);

      const peak = calculatePeak(monoBuffer);
      const peakDb = linearToDb(peak);

      const rms = calculateRMS(monoBuffer);
      const rmsDb = linearToDb(rms);

      const dynamicRange = calculateDynamicRange(peakDb, rmsDb);
      const crestFactor = calculateCrestFactor(peak, rms);

      // LUFS calculation (more intensive)
      const lufs = calculateLUFS(audioBuffer);

      const loudness = {
        peak,
        peakDb,
        rms,
        rmsDb,
        dynamicRange,
        crestFactor,
        lufs
      };

      if (abortRef.current) {
        throw new Error('Analysis cancelled');
      }

      // === STEREO ANALYSIS ===
      setProgress(60);

      const stereoWidth = numChannels > 1
        ? calculateStereoWidth(leftChannel, rightChannel)
        : 0;

      const phaseCorrelation = numChannels > 1
        ? calculatePhaseCorrelation(leftChannel, rightChannel)
        : 1;

      const balance = numChannels > 1
        ? calculateChannelBalance(leftChannel, rightChannel)
        : 0;

      const stereo = {
        width: stereoWidth,
        phaseCorrelation,
        balance,
        isMono: numChannels === 1 || stereoWidth < 5
      };

      if (abortRef.current) {
        throw new Error('Analysis cancelled');
      }

      // === QUALITY ANALYSIS ===
      setProgress(70);

      const { count: clipCount, positions: clipPositions } = detectClipping(monoBuffer);
      const dcOffset = calculateDCOffset(monoBuffer);
      const snr = estimateSNR(monoBuffer, sampleRate);

      const qualityMetrics = {
        peakDb,
        rmsDb,
        dynamicRange,
        snr,
        dcOffset,
        clipCount,
        clipPositions,
        phaseCorrelation,
        balance,
        numChannels
      };

      const qualityResult = calculateQualityScore(qualityMetrics);

      const quality = {
        ...qualityResult,
        snr,
        dcOffset,
        clipCount,
        clipPositions
      };

      if (abortRef.current) {
        throw new Error('Analysis cancelled');
      }

      // === FREQUENCY ANALYSIS ===
      setProgress(80);

      // Use OfflineAudioContext for FFT analysis
      const fftSize = 4096;
      const offlineCtx = new OfflineAudioContext(1, leftChannel.length, sampleRate);
      const offlineSource = offlineCtx.createBufferSource();

      // Create a buffer with mono data
      const offlineBuffer = offlineCtx.createBuffer(1, monoBuffer.length, sampleRate);
      offlineBuffer.getChannelData(0).set(monoBuffer);
      offlineSource.buffer = offlineBuffer;

      // Create analyser for offline context
      const offlineAnalyser = offlineCtx.createAnalyser();
      offlineAnalyser.fftSize = fftSize;

      offlineSource.connect(offlineAnalyser);
      offlineAnalyser.connect(offlineCtx.destination);
      offlineSource.start();

      // Render and get FFT data
      await offlineCtx.startRendering();

      // Get frequency data from multiple points in the audio
      const frequencySnapshots = [];
      const numSnapshots = 10;
      const snapshotSize = Math.floor(monoBuffer.length / numSnapshots);

      for (let s = 0; s < numSnapshots; s++) {
        const snapshot = new Float32Array(fftSize / 2);

        // Simple DFT for snapshot (Web Audio analyser only works during playback)
        const startIdx = s * snapshotSize;
        const windowData = monoBuffer.slice(startIdx, startIdx + fftSize);

        if (windowData.length === fftSize) {
          // Simple magnitude spectrum using autocorrelation approximation
          for (let k = 0; k < fftSize / 2; k++) {
            let real = 0, imag = 0;
            for (let n = 0; n < fftSize; n++) {
              const angle = (2 * Math.PI * k * n) / fftSize;
              real += windowData[n] * Math.cos(angle);
              imag -= windowData[n] * Math.sin(angle);
            }
            snapshot[k] = Math.sqrt(real * real + imag * imag) / fftSize;
          }
          frequencySnapshots.push(snapshot);
        }
      }

      if (abortRef.current) {
        throw new Error('Analysis cancelled');
      }

      setProgress(90);

      // Average the frequency snapshots
      const avgFrequencyData = new Float32Array(fftSize / 2);
      if (frequencySnapshots.length > 0) {
        for (let i = 0; i < fftSize / 2; i++) {
          let sum = 0;
          for (const snapshot of frequencySnapshots) {
            sum += snapshot[i];
          }
          avgFrequencyData[i] = sum / frequencySnapshots.length;
        }
      }

      // Normalize to 0-255 range for band analysis
      const maxFreq = Math.max(...avgFrequencyData);
      const normalizedFreqData = new Uint8Array(fftSize / 2);
      for (let i = 0; i < fftSize / 2; i++) {
        normalizedFreqData[i] = maxFreq > 0 ? Math.round((avgFrequencyData[i] / maxFreq) * 255) : 0;
      }

      const frequencyBands = analyzeFrequencyBands(normalizedFreqData, sampleRate, fftSize);

      // Calculate frequency balance/tilt
      const lowEnergy = frequencyBands.slice(0, 3).reduce((a, b) => a + b.energy, 0) / 3;
      const highEnergy = frequencyBands.slice(4).reduce((a, b) => a + b.energy, 0) / 3;
      const frequencyTilt = lowEnergy > 0 ? linearToDb(highEnergy / lowEnergy) : 0;

      const frequency = {
        bands: frequencyBands,
        tilt: frequencyTilt,
        rawData: avgFrequencyData
      };

      // === RECOMMENDATIONS ===
      setProgress(95);

      const recommendations = generateRecommendations(
        {
          ...loudness,
          ...stereo,
          ...quality,
          numChannels
        },
        targetPlatform
      );

      // === COMPILE RESULTS ===
      const results = {
        file: {
          name: audioFile.name,
          size: audioFile.size,
          type: audioFile.type,
          duration,
          sampleRate,
          numChannels
        },
        loudness,
        stereo,
        frequency,
        quality,
        recommendations,
        targetPlatform,
        analyzedAt: new Date().toISOString()
      };

      setAnalysisResults(results);
      setProgress(100);

      return results;

    } catch (err) {
      if (err.message !== 'Analysis cancelled') {
        setError(err.message || 'Analysis failed');
        console.error('Audio analysis error:', err);
      }
      return null;

    } finally {
      setIsAnalyzing(false);

      // Cleanup audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          await audioContextRef.current.close();
        } catch (e) {
          // Ignore close errors
        }
      }
    }
  }, [targetPlatform]);

  /**
   * Cancel ongoing analysis
   */
  const cancelAnalysis = useCallback(() => {
    abortRef.current = true;
    setIsAnalyzing(false);
    setProgress(0);
  }, []);

  /**
   * Clear analysis results
   */
  const clearResults = useCallback(() => {
    setAnalysisResults(null);
    setAudioBuffer(null);
    setError(null);
    setProgress(0);
  }, []);

  /**
   * Change target platform and regenerate recommendations
   */
  const changeTargetPlatform = useCallback((platform) => {
    if (!PLATFORM_TARGETS[platform]) {
      console.warn(`Unknown platform: ${platform}`);
      return;
    }

    setTargetPlatform(platform);

    // Regenerate recommendations if we have results
    if (analysisResults) {
      const newRecommendations = generateRecommendations(
        {
          ...analysisResults.loudness,
          ...analysisResults.stereo,
          ...analysisResults.quality,
          numChannels: analysisResults.file.numChannels
        },
        platform
      );

      setAnalysisResults(prev => ({
        ...prev,
        recommendations: newRecommendations,
        targetPlatform: platform
      }));
    }
  }, [analysisResults]);

  return {
    isAnalyzing,
    progress,
    analysisResults,
    audioBuffer,
    error,
    targetPlatform,
    analyzeFile,
    cancelAnalysis,
    clearResults,
    changeTargetPlatform,
    platforms: PLATFORM_TARGETS
  };
}

export default useAudioAnalyzer;
