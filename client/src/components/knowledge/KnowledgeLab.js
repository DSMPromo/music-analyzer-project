/**
 * KnowledgeLab Component
 * Main panel for browsing educational content, building song structures, and practicing
 */

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useKnowledgeLab } from '../../hooks/useKnowledgeLab';
import { useContextualTips } from '../../hooks/useContextualTips';
import { usePracticeProgress } from '../../hooks/usePracticeProgress';
import StructureBuilder from './StructureBuilder';

// KnowledgeCard component
function KnowledgeCard({ item, isExpanded, onToggle }) {
  const renderContent = () => {
    switch (item.type) {
      case 'structure':
        return (
          <div className="knowledge-card-details">
            <p className="knowledge-philosophy">{item.data.philosophy}</p>
            <div className="knowledge-stats">
              <span>Total Bars: {item.data.totalBars}</span>
              <span>BPM: {item.data.bpmRange?.[0]}-{item.data.bpmRange?.[1]}</span>
            </div>
          </div>
        );
      case 'section':
        return (
          <div className="knowledge-card-details">
            <p><strong>Purpose:</strong> {item.data.purpose}</p>
            <p><strong>Bars:</strong> {item.data.bars} | <strong>Energy:</strong> {item.data.energy}/10</p>
            {item.data.tips && (
              <ul className="knowledge-tips">
                {item.data.tips.map((tip, i) => <li key={i}>{tip}</li>)}
              </ul>
            )}
          </div>
        );
      case 'mode':
        return (
          <div className="knowledge-card-details">
            <p><strong>Character:</strong> {item.data.character}</p>
            <p><strong>Emotion:</strong> {item.data.emotion}</p>
            <p><strong>Genre Use:</strong> {item.data.genreUse}</p>
            {item.data.tips && (
              <ul className="knowledge-tips">
                {item.data.tips.map((tip, i) => <li key={i}>{tip}</li>)}
              </ul>
            )}
          </div>
        );
      case 'progression':
        return (
          <div className="knowledge-card-details">
            <p className="knowledge-numerals">{item.data.numerals}</p>
            <p className="knowledge-example">Example: {item.data.example}</p>
            <p><strong>Emotion:</strong> {item.data.emotion}</p>
            {item.data.songs && (
              <p className="knowledge-songs">Used in: {item.data.songs.join(', ')}</p>
            )}
          </div>
        );
      case 'pattern':
        return (
          <div className="knowledge-card-details">
            <p>{item.data.description}</p>
            {item.data.notation && (
              <div className="knowledge-pattern">
                {Object.entries(item.data.notation).map(([drum, pattern]) => (
                  <div key={drum} className="pattern-row">
                    <span className="pattern-label">{drum}:</span>
                    <code className="pattern-notation">{pattern}</code>
                  </div>
                ))}
              </div>
            )}
            {item.data.tips && (
              <ul className="knowledge-tips">
                {item.data.tips.map((tip, i) => <li key={i}>{tip}</li>)}
              </ul>
            )}
          </div>
        );
      case 'chain':
        return (
          <div className="knowledge-card-details">
            <p>{item.data.description}</p>
            {item.data.steps && (
              <ol className="knowledge-chain-steps">
                {item.data.steps.slice(0, isExpanded ? undefined : 5).map((step, i) => (
                  <li key={i}>
                    <strong>{step.plugin}</strong>
                    {step.note && <span className="step-note"> - {step.note}</span>}
                  </li>
                ))}
                {!isExpanded && item.data.steps.length > 5 && (
                  <li className="more-steps">...and {item.data.steps.length - 5} more steps</li>
                )}
              </ol>
            )}
          </div>
        );
      case 'artist':
        return (
          <div className="knowledge-card-details">
            <p><strong>Specialty:</strong> {item.data.specialty}</p>
            {item.data.techniques && (
              <p><strong>Techniques:</strong> {item.data.techniques.join(', ')}</p>
            )}
            {item.data.signatureSound && (
              <p><strong>Signature Sound:</strong> {item.data.signatureSound}</p>
            )}
            {item.data.referenceTracks && (
              <p className="knowledge-tracks">Reference: {item.data.referenceTracks.join(', ')}</p>
            )}
          </div>
        );
      case 'troubleshooting':
        return (
          <div className="knowledge-card-details">
            {item.data.symptoms && (
              <div className="knowledge-symptoms">
                <strong>Symptoms:</strong>
                <ul>{item.data.symptoms.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {item.data.solutions && (
              <div className="knowledge-solutions">
                <strong>Solutions:</strong>
                <ol>
                  {item.data.solutions.map((s, i) => (
                    <li key={i} className={`priority-${s.priority}`}>{s.action}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        );
      default:
        return <p>{item.content}</p>;
    }
  };

  return (
    <div className={`knowledge-card ${isExpanded ? 'expanded' : ''}`}>
      <div className="knowledge-card-header" onClick={onToggle}>
        <span className="knowledge-card-title">{item.title}</span>
        <span className="knowledge-card-type">{item.type}</span>
        <span className="knowledge-card-toggle">{isExpanded ? '−' : '+'}</span>
      </div>
      {isExpanded && (
        <div className="knowledge-card-content">
          {renderContent()}
        </div>
      )}
    </div>
  );
}

KnowledgeCard.propTypes = {
  item: PropTypes.object.isRequired,
  isExpanded: PropTypes.bool,
  onToggle: PropTypes.func
};

// KnowledgeCategory component
function KnowledgeCategory({ category, items, expandedItems, onToggle }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="knowledge-category">
      <div
        className="knowledge-category-header"
        onClick={() => setIsOpen(!isOpen)}
        style={{ borderLeftColor: category.color }}
      >
        <span className="category-icon">{category.icon}</span>
        <div className="category-info">
          <span className="category-name">{category.name}</span>
          <span className="category-description">{category.description}</span>
        </div>
        <span className="category-count">{items.length}</span>
        <span className="category-toggle">{isOpen ? '▼' : '▶'}</span>
      </div>
      {isOpen && (
        <div className="knowledge-category-content">
          {items.map(item => (
            <KnowledgeCard
              key={item.id}
              item={item}
              isExpanded={expandedItems.has(item.id)}
              onToggle={() => onToggle(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

KnowledgeCategory.propTypes = {
  category: PropTypes.object.isRequired,
  items: PropTypes.array.isRequired,
  expandedItems: PropTypes.object.isRequired,
  onToggle: PropTypes.func.isRequired
};

// PracticePanel component
function PracticePanel() {
  const {
    currentWeek,
    currentExercise,
    currentProgress,
    overallProgress,
    weekProgress,
    activeWeek,
    activeExercise,
    setActiveWeek,
    nextExercise,
    prevExercise,
    toggleCriterion,
    markCompleted,
    updateNotes,
    weeks
  } = usePracticeProgress();

  return (
    <div className="practice-panel">
      <div className="practice-header">
        <h3>Practice Exercises</h3>
        <div className="practice-overall-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${overallProgress.percentage}%` }}
            />
          </div>
          <span>{overallProgress.completed}/{overallProgress.total} Complete</span>
        </div>
      </div>

      <div className="practice-weeks">
        {Object.entries(weeks).map(([weekKey, week]) => (
          <button
            key={weekKey}
            className={`week-button ${activeWeek === weekKey ? 'active' : ''}`}
            onClick={() => setActiveWeek(weekKey)}
          >
            <span className="week-name">{week.theme}</span>
            <span className="week-progress">{weekProgress[weekKey]?.percentage || 0}%</span>
          </button>
        ))}
      </div>

      <div className="practice-exercise">
        <div className="exercise-header">
          <h4>{currentExercise.title}</h4>
          <span className="exercise-days">Days {currentExercise.days}</span>
        </div>

        <p className="exercise-task">{currentExercise.task}</p>

        <div className="exercise-criteria">
          <h5>Criteria:</h5>
          {currentExercise.criteria.map((criterion, i) => (
            <label key={i} className="criterion-item">
              <input
                type="checkbox"
                checked={currentProgress.criteria[i] || false}
                onChange={() => toggleCriterion(activeWeek, activeExercise, i)}
              />
              <span>{criterion}</span>
            </label>
          ))}
        </div>

        <div className="exercise-notes">
          <textarea
            placeholder="Add your notes..."
            value={currentProgress.notes || ''}
            onChange={(e) => updateNotes(activeWeek, activeExercise, e.target.value)}
          />
        </div>

        <div className="exercise-nav">
          <button onClick={prevExercise}>Previous</button>
          <button
            className={currentProgress.completed ? 'completed' : ''}
            onClick={() => markCompleted(activeWeek, activeExercise, !currentProgress.completed)}
          >
            {currentProgress.completed ? 'Completed' : 'Mark Complete'}
          </button>
          <button onClick={nextExercise}>Next</button>
        </div>
      </div>
    </div>
  );
}

// ContextualTipsDrawer component
function ContextualTipsDrawer({ tips, isOpen, onClose, onViewKnowledge }) {
  if (!isOpen) return null;

  return (
    <div className="tips-drawer">
      <div className="tips-header">
        <h4>Tips for Your Track</h4>
        <button onClick={onClose} className="tips-close">x</button>
      </div>
      <div className="tips-content">
        {tips.length === 0 ? (
          <p className="tips-empty">No specific tips based on current analysis.</p>
        ) : (
          tips.map(tip => (
            <div key={tip.id} className={`tip-card priority-${tip.priority}`}>
              <span className="tip-category">{tip.category}</span>
              <p className="tip-text">{tip.text}</p>
              {tip.relatedKnowledge && (
                <button
                  className="tip-learn-more"
                  onClick={() => onViewKnowledge(tip.relatedKnowledge)}
                >
                  Learn more
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

ContextualTipsDrawer.propTypes = {
  tips: PropTypes.array.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onViewKnowledge: PropTypes.func.isRequired
};

// Main KnowledgeLab component
function KnowledgeLab({
  analysisContext = {},
  detectedGenre,
  bpm,
  detectedKey,
  onApplyStructure
}) {
  const {
    activeView,
    setActiveView,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    expandedItems,
    toggleExpanded,
    clearSearch,
    searchResults,
    getItemsByCategory,
    categories,
    selectedGenre,
    setSelectedGenre,
    structureData
  } = useKnowledgeLab();

  const {
    tips,
    isDrawerOpen,
    setIsDrawerOpen,
    hasTips,
    highPriorityCount
  } = useContextualTips({
    ...analysisContext,
    genre: detectedGenre,
    bpm,
    key: detectedKey
  });

  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleViewKnowledge = useCallback((knowledgeId) => {
    setActiveView('browse');
    toggleExpanded(knowledgeId);
    setIsDrawerOpen(false);
  }, [setActiveView, toggleExpanded, setIsDrawerOpen]);

  if (isCollapsed) {
    return (
      <div className="knowledge-lab collapsed">
        <button
          className="knowledge-lab-expand"
          onClick={() => setIsCollapsed(false)}
        >
          <span className="expand-icon">📚</span>
          <span>Knowledge Lab</span>
          {hasTips && (
            <span className="tips-badge">{highPriorityCount || tips.length}</span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="knowledge-lab">
      <div className="knowledge-lab-header">
        <div className="header-title">
          <h2>Knowledge Lab</h2>
          <button
            className="collapse-button"
            onClick={() => setIsCollapsed(true)}
            title="Collapse"
          >
            −
          </button>
        </div>

        <div className="header-controls">
          <div className="view-tabs">
            <button
              className={activeView === 'browse' ? 'active' : ''}
              onClick={() => setActiveView('browse')}
            >
              Browse
            </button>
            <button
              className={activeView === 'structure' ? 'active' : ''}
              onClick={() => setActiveView('structure')}
            >
              Structure Builder
            </button>
            <button
              className={activeView === 'practice' ? 'active' : ''}
              onClick={() => setActiveView('practice')}
            >
              Practice
            </button>
          </div>

          {hasTips && (
            <button
              className="tips-toggle"
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            >
              Tips {highPriorityCount > 0 && <span className="tips-badge">{highPriorityCount}</span>}
            </button>
          )}
        </div>

        {activeView === 'browse' && (
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search knowledge base..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={clearSearch} className="clear-search">x</button>
            )}
          </div>
        )}
      </div>

      <div className="knowledge-lab-content">
        {activeView === 'browse' && (
          <div className="browse-view">
            {searchQuery ? (
              <div className="search-results">
                <h3>Search Results ({searchResults.length})</h3>
                {searchResults.map(item => (
                  <KnowledgeCard
                    key={item.id}
                    item={item}
                    isExpanded={expandedItems.has(item.id)}
                    onToggle={() => toggleExpanded(item.id)}
                  />
                ))}
                {searchResults.length === 0 && (
                  <p className="no-results">No results found for "{searchQuery}"</p>
                )}
              </div>
            ) : (
              <div className="categories-list">
                {categories.map(category => (
                  <KnowledgeCategory
                    key={category.id}
                    category={category}
                    items={getItemsByCategory(category.id)}
                    expandedItems={expandedItems}
                    onToggle={toggleExpanded}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'structure' && (
          <StructureBuilder
            initialBpm={bpm || 120}
            initialGenre={detectedGenre || 'pop'}
            onExport={onApplyStructure}
          />
        )}

        {activeView === 'practice' && (
          <PracticePanel />
        )}
      </div>

      <ContextualTipsDrawer
        tips={tips}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onViewKnowledge={handleViewKnowledge}
      />
    </div>
  );
}

KnowledgeLab.propTypes = {
  analysisContext: PropTypes.object,
  detectedGenre: PropTypes.string,
  bpm: PropTypes.number,
  detectedKey: PropTypes.string,
  onApplyStructure: PropTypes.func
};

export default KnowledgeLab;
