/**
 * PersonalKnowledge Component
 *
 * Self-learning knowledge base UI with:
 * - Favorite instruments with dial-in configs
 * - BPM-synced calculations
 * - AI assistant integration
 * - Quick reference cards
 */

import React, { useState, useCallback } from 'react';
import { usePersonalKnowledge } from '../../hooks/usePersonalKnowledge';

export function PersonalKnowledge({ currentBPM = 120, onAskAI }) {
  const {
    isLoaded,
    preferences,
    bpmSync,
    getAllPresets,
    getDialInConfig,
    getFavoriteConfigs,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    getQuickDialIn,
    formatMs,
  } = usePersonalKnowledge(currentBPM);

  const [activeTab, setActiveTab] = useState('favorites');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [showAllPresets, setShowAllPresets] = useState(false);

  // Handle preset selection
  const handleSelectPreset = useCallback((presetId) => {
    const config = getDialInConfig(presetId);
    setSelectedPreset(config);
  }, [getDialInConfig]);

  // Handle favorite toggle
  const handleToggleFavorite = useCallback((presetId) => {
    if (isFavorite(presetId)) {
      removeFromFavorites(presetId);
    } else {
      addToFavorites(presetId);
    }
  }, [isFavorite, addToFavorites, removeFromFavorites]);

  // Ask AI about current preset
  const handleAskAI = useCallback((question) => {
    if (onAskAI && selectedPreset) {
      const context = `I'm working with ${selectedPreset.preset} at ${currentBPM} BPM. ${question}`;
      onAskAI(context);
    }
  }, [onAskAI, selectedPreset, currentBPM]);

  if (!isLoaded) {
    return <div className="personal-knowledge loading">Loading...</div>;
  }

  const allPresets = getAllPresets();
  const favoriteConfigs = getFavoriteConfigs();
  const delayQuick = getQuickDialIn('delay');
  const reverbQuick = getQuickDialIn('reverb');
  const compQuick = getQuickDialIn('compressor');

  return (
    <div className="personal-knowledge">
      {/* Header with BPM */}
      <div className="pk-header">
        <h2>My Knowledge Base</h2>
        <div className="pk-bpm-display">
          <span className="bpm-value">{currentBPM}</span>
          <span className="bpm-label">BPM</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="pk-tabs">
        <button
          className={`pk-tab ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => setActiveTab('favorites')}
        >
          Favorites
        </button>
        <button
          className={`pk-tab ${activeTab === 'timing' ? 'active' : ''}`}
          onClick={() => setActiveTab('timing')}
        >
          BPM Sync
        </button>
        <button
          className={`pk-tab ${activeTab === 'presets' ? 'active' : ''}`}
          onClick={() => setActiveTab('presets')}
        >
          All Presets
        </button>
      </div>

      {/* Tab Content */}
      <div className="pk-content">
        {/* Favorites Tab */}
        {activeTab === 'favorites' && (
          <div className="pk-favorites">
            {favoriteConfigs.length === 0 ? (
              <div className="pk-empty">
                <p>No favorites yet.</p>
                <p>Add instruments you love and get instant dial-in configs!</p>
                <button
                  className="btn btn-primary"
                  onClick={() => setActiveTab('presets')}
                >
                  Browse Presets
                </button>
              </div>
            ) : (
              <div className="pk-favorites-list">
                {favoriteConfigs.map(({ id, config, useCount }) => (
                  <div
                    key={id}
                    className={`pk-favorite-card ${selectedPreset?.preset === config.preset ? 'selected' : ''}`}
                    onClick={() => handleSelectPreset(id)}
                  >
                    <div className="card-header">
                      <h4>{config.preset}</h4>
                      <span className="use-count">{useCount}x</span>
                    </div>
                    <div className="card-category">{config.category}</div>
                    <div className="card-timing">
                      {config.mixSettings?.delay && (
                        <span>Delay: {config.mixSettings.delay.timeMs}ms</span>
                      )}
                      {config.mixSettings?.reverb && (
                        <span>Reverb: {config.mixSettings.reverb.decayMs}ms</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BPM Sync Tab */}
        {activeTab === 'timing' && bpmSync && (
          <div className="pk-timing">
            {/* Note Values */}
            <div className="timing-section">
              <h4>Note Values</h4>
              <div className="timing-grid">
                <div className="timing-item">
                  <span className="label">Whole</span>
                  <span className="value">{formatMs(bpmSync.whole)}</span>
                </div>
                <div className="timing-item">
                  <span className="label">Half</span>
                  <span className="value">{formatMs(bpmSync.half)}</span>
                </div>
                <div className="timing-item">
                  <span className="label">Quarter</span>
                  <span className="value">{formatMs(bpmSync.quarter)}</span>
                </div>
                <div className="timing-item">
                  <span className="label">Eighth</span>
                  <span className="value">{formatMs(bpmSync.eighth)}</span>
                </div>
                <div className="timing-item">
                  <span className="label">Sixteenth</span>
                  <span className="value">{formatMs(bpmSync.sixteenth)}</span>
                </div>
                <div className="timing-item">
                  <span className="label">Dotted 1/8</span>
                  <span className="value">{formatMs(bpmSync.dottedEighth)}</span>
                </div>
                <div className="timing-item">
                  <span className="label">Triplet 1/8</span>
                  <span className="value">{formatMs(bpmSync.tripletEighth)}</span>
                </div>
              </div>
            </div>

            {/* Delay Presets */}
            {delayQuick && (
              <div className="timing-section">
                <h4>{delayQuick.title}</h4>
                <div className="timing-grid">
                  {Object.entries(delayQuick.values).map(([label, value]) => (
                    <div key={label} className="timing-item">
                      <span className="label">{label}</span>
                      <span className="value">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reverb Presets */}
            {reverbQuick && (
              <div className="timing-section">
                <h4>{reverbQuick.title}</h4>
                <div className="timing-grid">
                  {Object.entries(reverbQuick.values).map(([label, value]) => (
                    <div key={label} className="timing-item">
                      <span className="label">{label}</span>
                      <span className="value">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Compressor */}
            {compQuick && (
              <div className="timing-section">
                <h4>{compQuick.title}</h4>
                <div className="timing-grid">
                  {Object.entries(compQuick.values).map(([label, value]) => (
                    <div key={label} className="timing-item">
                      <span className="label">{label}</span>
                      <span className="value">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* All Presets Tab */}
        {activeTab === 'presets' && (
          <div className="pk-presets">
            <div className="presets-grid">
              {allPresets.map((preset) => (
                <div
                  key={preset.id}
                  className={`preset-card ${isFavorite(preset.id) ? 'favorited' : ''}`}
                >
                  <div className="preset-header">
                    <h4>{preset.name}</h4>
                    <button
                      className={`fav-btn ${isFavorite(preset.id) ? 'active' : ''}`}
                      onClick={() => handleToggleFavorite(preset.id)}
                      title={isFavorite(preset.id) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {isFavorite(preset.id) ? '★' : '☆'}
                    </button>
                  </div>
                  <div className="preset-category">{preset.category}</div>
                  <p className="preset-desc">{preset.description}</p>
                  <button
                    className="btn btn-small"
                    onClick={() => handleSelectPreset(preset.id)}
                  >
                    View Config
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Selected Preset Detail */}
      {selectedPreset && (
        <div className="pk-detail-panel">
          <div className="detail-header">
            <h3>{selectedPreset.preset}</h3>
            <span className="detail-bpm">@ {selectedPreset.bpm} BPM</span>
            <button
              className="close-btn"
              onClick={() => setSelectedPreset(null)}
            >
              ×
            </button>
          </div>

          <div className="detail-content">
            {/* Timing Reference */}
            {selectedPreset.timingReference && (
              <div className="detail-section">
                <h4>Timing Reference</h4>
                <div className="timing-ref">
                  {Object.entries(selectedPreset.timingReference).map(([key, value]) => (
                    <div key={key} className="timing-ref-item">
                      <span className="key">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="value">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mix Settings */}
            {selectedPreset.mixSettings && (
              <>
                {/* EQ */}
                {selectedPreset.mixSettings.eq && (
                  <div className="detail-section">
                    <h4>EQ</h4>
                    <div className="settings-list">
                      {selectedPreset.mixSettings.eq.lowCut && (
                        <div className="setting">Low Cut: {selectedPreset.mixSettings.eq.lowCut}Hz</div>
                      )}
                      {selectedPreset.mixSettings.eq.lowShelf && (
                        <div className="setting">
                          Low Shelf: {selectedPreset.mixSettings.eq.lowShelf.freq}Hz @ {selectedPreset.mixSettings.eq.lowShelf.gain}dB
                        </div>
                      )}
                      {selectedPreset.mixSettings.eq.mid && (
                        <div className="setting">
                          Mid: {selectedPreset.mixSettings.eq.mid.freq}Hz @ {selectedPreset.mixSettings.eq.mid.gain}dB (Q: {selectedPreset.mixSettings.eq.mid.q})
                        </div>
                      )}
                      {selectedPreset.mixSettings.eq.highShelf && (
                        <div className="setting">
                          High Shelf: {selectedPreset.mixSettings.eq.highShelf.freq}Hz @ {selectedPreset.mixSettings.eq.highShelf.gain}dB
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Compression */}
                {selectedPreset.mixSettings.compression && (
                  <div className="detail-section">
                    <h4>Compression</h4>
                    <div className="settings-list">
                      <div className="setting">Threshold: {selectedPreset.mixSettings.compression.threshold}dB</div>
                      <div className="setting">Ratio: {selectedPreset.mixSettings.compression.ratio}:1</div>
                      <div className="setting">Attack: {selectedPreset.mixSettings.compression.attack}ms</div>
                      <div className="setting highlight">
                        Release: {selectedPreset.mixSettings.compression.release}ms
                        {selectedPreset.mixSettings.compression.releaseNote && (
                          <span className="note"> ({selectedPreset.mixSettings.compression.releaseNote})</span>
                        )}
                      </div>
                      {selectedPreset.mixSettings.compression.makeup && (
                        <div className="setting">Makeup: +{selectedPreset.mixSettings.compression.makeup}dB</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Reverb */}
                {selectedPreset.mixSettings.reverb && (
                  <div className="detail-section">
                    <h4>Reverb</h4>
                    <div className="settings-list">
                      <div className="setting">Type: {selectedPreset.mixSettings.reverb.type}</div>
                      {selectedPreset.mixSettings.reverb.preDelayMs && (
                        <div className="setting highlight">
                          Pre-delay: {selectedPreset.mixSettings.reverb.preDelayMs}ms
                          <span className="note"> ({selectedPreset.mixSettings.reverb.preDelayNote})</span>
                        </div>
                      )}
                      {selectedPreset.mixSettings.reverb.decayMs && (
                        <div className="setting highlight">
                          Decay: {selectedPreset.mixSettings.reverb.decayMs}ms
                          <span className="note"> ({selectedPreset.mixSettings.reverb.decayNote})</span>
                        </div>
                      )}
                      <div className="setting">Mix: {selectedPreset.mixSettings.reverb.mix}%</div>
                    </div>
                  </div>
                )}

                {/* Delay */}
                {selectedPreset.mixSettings.delay && (
                  <div className="detail-section">
                    <h4>Delay</h4>
                    <div className="settings-list">
                      <div className="setting highlight">
                        Time: {selectedPreset.mixSettings.delay.timeMs}ms
                        {selectedPreset.mixSettings.delay.timeNote && (
                          <span className="note"> ({selectedPreset.mixSettings.delay.timeNote})</span>
                        )}
                      </div>
                      <div className="setting">Feedback: {selectedPreset.mixSettings.delay.feedback}%</div>
                      <div className="setting">Mix: {selectedPreset.mixSettings.delay.mix}%</div>
                      {selectedPreset.mixSettings.delay.pingPong && (
                        <div className="setting">Ping Pong: On</div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Tips */}
            {selectedPreset.tips && selectedPreset.tips.length > 0 && (
              <div className="detail-section">
                <h4>Tips</h4>
                <ul className="tips-list">
                  {selectedPreset.tips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI Actions */}
            {onAskAI && (
              <div className="detail-actions">
                <button
                  className="btn btn-ai"
                  onClick={() => handleAskAI('How can I make this sound better?')}
                >
                  Ask AI for tips
                </button>
                <button
                  className="btn btn-ai"
                  onClick={() => handleAskAI('What processing chain should I use?')}
                >
                  Get full chain
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonalKnowledge;
