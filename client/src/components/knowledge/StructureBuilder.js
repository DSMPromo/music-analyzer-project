/**
 * StructureBuilder Component
 * Drag-and-drop song structure planner with timeline visualization
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useStructureBuilder } from '../../hooks/useStructureBuilder';
import { SONG_STRUCTURES } from '../../data/songStructures';

// SectionPalette - Source of draggable sections
function SectionPalette({ sectionTypes, onDragStart }) {
  return (
    <div className="section-palette">
      <h4>Sections</h4>
      <div className="palette-items">
        {sectionTypes.map(type => (
          <div
            key={type.id}
            className="palette-section"
            draggable
            onDragStart={(e) => onDragStart(e, type)}
            style={{ backgroundColor: type.color }}
          >
            <span className="section-name">{type.name}</span>
            <span className="section-bars">{type.defaultBars} bars</span>
          </div>
        ))}
      </div>
    </div>
  );
}

SectionPalette.propTypes = {
  sectionTypes: PropTypes.array.isRequired,
  onDragStart: PropTypes.func.isRequired
};

// StructureTimeline - Drop target and visualization
function StructureTimeline({
  sectionPositions,
  bpm,
  totalBars,
  dragOverIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onRemove,
  onResize,
  getSectionType
}) {
  const barWidth = 12; // pixels per bar
  const timelineWidth = Math.max(totalBars * barWidth, 600);

  // Generate bar markers
  const barMarkers = [];
  for (let i = 0; i <= totalBars; i += 8) {
    barMarkers.push(i || 1);
  }

  return (
    <div className="structure-timeline">
      {/* Bar markers */}
      <div className="bar-markers" style={{ width: timelineWidth }}>
        {barMarkers.map(bar => (
          <span
            key={bar}
            className="bar-marker"
            style={{ left: (bar - 1) * barWidth }}
          >
            {bar}
          </span>
        ))}
      </div>

      {/* Sections track */}
      <div
        className="sections-track"
        style={{ width: timelineWidth }}
        onDragOver={(e) => onDragOver(e, sectionPositions.length)}
        onDrop={(e) => onDrop(e, sectionPositions.length)}
      >
        {sectionPositions.map((section, index) => {
          const sectionType = section.sectionType;
          return (
            <div
              key={section.id}
              className={`timeline-section ${dragOverIndex === index ? 'drag-over' : ''}`}
              style={{
                left: (section.startBar - 1) * barWidth,
                width: section.bars * barWidth,
                backgroundColor: sectionType.color
              }}
              draggable
              onDragStart={(e) => onDragStart(e, sectionType, index)}
              onDragOver={(e) => {
                e.stopPropagation();
                onDragOver(e, index);
              }}
              onDrop={(e) => {
                e.stopPropagation();
                onDrop(e, index);
              }}
              onDragEnd={onDragEnd}
            >
              <span className="section-label">{sectionType.name}</span>
              <span className="section-bars">{section.bars}b</span>
              <button
                className="section-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(section.id);
                }}
              >
                x
              </button>
              <div
                className="resize-handle"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const startX = e.clientX;
                  const startBars = section.bars;

                  const handleMouseMove = (moveE) => {
                    const delta = moveE.clientX - startX;
                    const barDelta = Math.round(delta / barWidth);
                    const newBars = Math.max(4, startBars + barDelta);
                    onResize(section.id, newBars);
                  };

                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };

                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
              />
            </div>
          );
        })}

        {/* Drop zone at end */}
        {sectionPositions.length === 0 && (
          <div className="drop-zone-empty">
            Drag sections here to build your structure
          </div>
        )}
      </div>

      {/* Energy curve */}
      <div className="energy-curve" style={{ width: timelineWidth }}>
        {sectionPositions.map(section => (
          <div
            key={section.id}
            className="energy-bar"
            style={{
              left: (section.startBar - 1) * barWidth,
              width: section.bars * barWidth,
              height: `${section.energy * 10}%`
            }}
          />
        ))}
      </div>
    </div>
  );
}

StructureTimeline.propTypes = {
  sectionPositions: PropTypes.array.isRequired,
  bpm: PropTypes.number.isRequired,
  totalBars: PropTypes.number.isRequired,
  dragOverIndex: PropTypes.number,
  onDragStart: PropTypes.func.isRequired,
  onDragOver: PropTypes.func.isRequired,
  onDrop: PropTypes.func.isRequired,
  onDragEnd: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  onResize: PropTypes.func.isRequired,
  getSectionType: PropTypes.func.isRequired
};

// StructureStats - Summary statistics
function StructureStats({ totalBars, formattedDuration, bpm, genreMatchScore, selectedGenre }) {
  return (
    <div className="structure-stats">
      <div className="stat">
        <span className="stat-label">Total Bars</span>
        <span className="stat-value">{totalBars}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Duration</span>
        <span className="stat-value">{formattedDuration}</span>
      </div>
      <div className="stat">
        <span className="stat-label">BPM</span>
        <span className="stat-value">{bpm}</span>
      </div>
      <div className="stat">
        <span className="stat-label">{selectedGenre} Match</span>
        <span className={`stat-value ${genreMatchScore >= 70 ? 'good' : genreMatchScore >= 40 ? 'warning' : ''}`}>
          {genreMatchScore}%
        </span>
      </div>
    </div>
  );
}

StructureStats.propTypes = {
  totalBars: PropTypes.number.isRequired,
  formattedDuration: PropTypes.string.isRequired,
  bpm: PropTypes.number.isRequired,
  genreMatchScore: PropTypes.number.isRequired,
  selectedGenre: PropTypes.string.isRequired
};

// Main StructureBuilder component
function StructureBuilder({ initialBpm, initialGenre, onExport }) {
  const {
    sections,
    sectionPositions,
    bpm,
    setBpm,
    selectedGenre,
    setSelectedGenre,
    totalBars,
    formattedDuration,
    genreMatchScore,
    dragOverIndex,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    removeSection,
    resizeSection,
    clearSections,
    applyTemplate,
    getSectionType,
    exportAsMarkers,
    SECTION_TYPES
  } = useStructureBuilder(initialBpm);

  const handleExport = useCallback(() => {
    const markers = exportAsMarkers();
    if (onExport) {
      onExport({
        markers,
        bpm,
        totalBars,
        duration: formattedDuration,
        genre: selectedGenre
      });
    }
  }, [exportAsMarkers, onExport, bpm, totalBars, formattedDuration, selectedGenre]);

  return (
    <div className="structure-builder">
      {/* Toolbar */}
      <div className="structure-toolbar">
        <div className="toolbar-group">
          <label>Genre Template:</label>
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
          >
            {Object.entries(SONG_STRUCTURES).map(([id, structure]) => (
              <option key={id} value={id}>{structure.name}</option>
            ))}
          </select>
          <button onClick={() => applyTemplate(selectedGenre)}>
            Apply Template
          </button>
        </div>

        <div className="toolbar-group">
          <label>BPM:</label>
          <input
            type="number"
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
            min={60}
            max={200}
          />
        </div>

        <div className="toolbar-group">
          <button onClick={clearSections} className="clear-btn">
            Clear All
          </button>
          <button onClick={handleExport} className="export-btn" disabled={sections.length === 0}>
            Export Markers
          </button>
        </div>
      </div>

      <div className="structure-builder-main">
        {/* Section Palette */}
        <SectionPalette
          sectionTypes={SECTION_TYPES}
          onDragStart={handleDragStart}
        />

        {/* Timeline */}
        <div className="structure-timeline-container">
          <StructureTimeline
            sectionPositions={sectionPositions}
            bpm={bpm}
            totalBars={totalBars}
            dragOverIndex={dragOverIndex}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            onRemove={removeSection}
            onResize={resizeSection}
            getSectionType={getSectionType}
          />

          {/* Stats */}
          <StructureStats
            totalBars={totalBars}
            formattedDuration={formattedDuration}
            bpm={bpm}
            genreMatchScore={genreMatchScore}
            selectedGenre={selectedGenre}
          />
        </div>
      </div>

      {/* Genre info */}
      {selectedGenre && SONG_STRUCTURES[selectedGenre] && (
        <div className="structure-info">
          <h4>{SONG_STRUCTURES[selectedGenre].name} Structure</h4>
          <p>{SONG_STRUCTURES[selectedGenre].description}</p>
          <div className="structure-map">
            <code>{SONG_STRUCTURES[selectedGenre].structureMap}</code>
          </div>
        </div>
      )}
    </div>
  );
}

StructureBuilder.propTypes = {
  initialBpm: PropTypes.number,
  initialGenre: PropTypes.string,
  onExport: PropTypes.func
};

StructureBuilder.defaultProps = {
  initialBpm: 120,
  initialGenre: 'pop'
};

export default StructureBuilder;
