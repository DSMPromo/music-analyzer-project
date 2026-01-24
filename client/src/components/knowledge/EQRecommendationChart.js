import React, { useMemo } from 'react';

/**
 * EQRecommendationChart - SVG visualization of EQ recommendations
 * Shows current vs recommended frequency curve
 */
function EQRecommendationChart({ recommendations = [], currentSpectrum = null, width = 600, height = 250 }) {
  // Frequency bands with positions
  const bands = useMemo(() => [
    { name: 'Sub', freq: 40, x: 0.05 },
    { name: 'Bass', freq: 150, x: 0.15 },
    { name: 'Low-Mid', freq: 375, x: 0.28 },
    { name: 'Mid', freq: 1000, x: 0.45 },
    { name: 'High-Mid', freq: 3000, x: 0.62 },
    { name: 'Presence', freq: 5000, x: 0.75 },
    { name: 'Brilliance', freq: 12000, x: 0.92 }
  ], []);

  // Convert recommendations to curve points
  const curvePoints = useMemo(() => {
    return bands.map(band => {
      const rec = recommendations.find(r =>
        r.band === band.name ||
        (r.frequencyRange && r.frequencyRange[0] <= band.freq && r.frequencyRange[1] >= band.freq)
      );

      return {
        ...band,
        change: rec?.recommendedChange || 0,
        priority: rec?.priority || 'low'
      };
    });
  }, [bands, recommendations]);

  // Generate SVG path for the curve
  const generatePath = (points, valueKey = 'change') => {
    if (points.length < 2) return '';

    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;
    const centerY = height / 2;
    const maxDb = 12; // +/- 12dB range

    const getY = (db) => centerY - (db / maxDb) * (graphHeight / 2);
    const getX = (xRatio) => padding + xRatio * graphWidth;

    // Create smooth curve using bezier
    let path = `M ${getX(points[0].x)} ${getY(points[0][valueKey] || 0)}`;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const prevX = getX(prev.x);
      const currX = getX(curr.x);
      const prevY = getY(prev[valueKey] || 0);
      const currY = getY(curr[valueKey] || 0);

      const cpX = (prevX + currX) / 2;
      path += ` C ${cpX} ${prevY}, ${cpX} ${currY}, ${currX} ${currY}`;
    }

    return path;
  };

  const padding = 40;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;
  const centerY = height / 2;
  const maxDb = 12;

  // Grid lines
  const gridLines = [-12, -6, 0, 6, 12];

  return (
    <div className="eq-chart-container">
      <svg width={width} height={height} className="eq-chart">
        {/* Background */}
        <rect x="0" y="0" width={width} height={height} fill="#1a1a2e" rx="8" />

        {/* Grid */}
        <g className="grid-lines">
          {gridLines.map(db => {
            const y = centerY - (db / maxDb) * (graphHeight / 2);
            return (
              <g key={db}>
                <line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke={db === 0 ? '#4a5568' : '#2d3748'}
                  strokeWidth={db === 0 ? 2 : 1}
                  strokeDasharray={db === 0 ? '' : '4,4'}
                />
                <text
                  x={padding - 8}
                  y={y + 4}
                  fill="#718096"
                  fontSize="10"
                  textAnchor="end"
                >
                  {db > 0 ? `+${db}` : db}
                </text>
              </g>
            );
          })}
        </g>

        {/* Frequency labels */}
        <g className="freq-labels">
          {bands.map(band => {
            const x = padding + band.x * graphWidth;
            return (
              <g key={band.name}>
                <line
                  x1={x}
                  y1={padding}
                  x2={x}
                  y2={height - padding}
                  stroke="#2d3748"
                  strokeWidth="1"
                  strokeDasharray="2,4"
                />
                <text
                  x={x}
                  y={height - 10}
                  fill="#718096"
                  fontSize="9"
                  textAnchor="middle"
                >
                  {band.freq >= 1000 ? `${band.freq / 1000}k` : band.freq}
                </text>
                <text
                  x={x}
                  y={height - 22}
                  fill="#a0aec0"
                  fontSize="8"
                  textAnchor="middle"
                >
                  {band.name}
                </text>
              </g>
            );
          })}
        </g>

        {/* Zero line highlight */}
        <line
          x1={padding}
          y1={centerY}
          x2={width - padding}
          y2={centerY}
          stroke="#4a5568"
          strokeWidth="2"
        />

        {/* Recommendation curve */}
        <path
          d={generatePath(curvePoints)}
          fill="none"
          stroke="#e94560"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Fill under curve */}
        <path
          d={`${generatePath(curvePoints)} L ${padding + curvePoints[curvePoints.length - 1].x * graphWidth} ${centerY} L ${padding + curvePoints[0].x * graphWidth} ${centerY} Z`}
          fill="url(#eqGradient)"
          opacity="0.3"
        />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="eqGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e94560" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#e94560" stopOpacity="0" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Data points */}
        {curvePoints.map((point, idx) => {
          const x = padding + point.x * graphWidth;
          const y = centerY - (point.change / maxDb) * (graphHeight / 2);
          const color = point.priority === 'high' ? '#ef4444' :
                        point.priority === 'medium' ? '#f59e0b' : '#10b981';

          return (
            <g key={idx} className="data-point">
              <circle
                cx={x}
                cy={y}
                r={point.change !== 0 ? 6 : 4}
                fill={point.change !== 0 ? color : '#4a5568'}
                stroke="#1a1a2e"
                strokeWidth="2"
              />
              {point.change !== 0 && (
                <text
                  x={x}
                  y={y - 12}
                  fill={color}
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {point.change > 0 ? '+' : ''}{point.change}dB
                </text>
              )}
            </g>
          );
        })}

        {/* Legend */}
        <g className="legend" transform={`translate(${width - 120}, 15)`}>
          <circle cx="5" cy="5" r="4" fill="#ef4444" />
          <text x="15" y="9" fill="#a0aec0" fontSize="9">High Priority</text>
          <circle cx="5" cy="20" r="4" fill="#f59e0b" />
          <text x="15" y="24" fill="#a0aec0" fontSize="9">Medium</text>
          <circle cx="5" cy="35" r="4" fill="#10b981" />
          <text x="15" y="39" fill="#a0aec0" fontSize="9">Low/Fine</text>
        </g>
      </svg>

      {/* EQ Band Details */}
      <div className="eq-bands-list">
        {recommendations.filter(r => r.recommendedChange !== 0 || r.priority !== 'low').map((rec, idx) => (
          <div key={idx} className={`eq-band-item priority-${rec.priority}`}>
            <div className="band-header">
              <span className="band-name">{rec.band}</span>
              <span className={`band-change ${rec.recommendedChange >= 0 ? 'boost' : 'cut'}`}>
                {rec.recommendedChange >= 0 ? '+' : ''}{rec.recommendedChange}dB
              </span>
            </div>
            <div className="band-details">
              <span className="band-freq">
                {rec.specificFrequency
                  ? formatFreq(rec.specificFrequency)
                  : `${formatFreq(rec.frequencyRange?.[0])}-${formatFreq(rec.frequencyRange?.[1])}`
                }
              </span>
              <span className="band-type">{rec.type || 'bell'}</span>
              <span className="band-q">Q: {rec.q || 1.0}</span>
            </div>
            {rec.reason && <div className="band-reason">{rec.reason}</div>}
            {rec.problems?.length > 0 && (
              <div className="band-problems">Issues: {rec.problems.join(', ')}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Format frequency for display
function formatFreq(freq) {
  if (!freq) return '--';
  if (freq >= 1000) return `${(freq / 1000).toFixed(1)}kHz`;
  return `${Math.round(freq)}Hz`;
}

export default EQRecommendationChart;
