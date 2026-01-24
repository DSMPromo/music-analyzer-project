/**
 * @module exportUtils
 * @description Export Utilities for Audio Optimization Reports
 *
 * Provides export functionality:
 * - JSON export (for programmatic use)
 * - PDF report generation (professional documentation)
 * - DAW-ready settings format (copy-paste)
 * - Clipboard copy utilities
 */

// ============================================
// JSON EXPORT
// ============================================

/**
 * Export optimization data as JSON
 * @param {Object} optimizationData - Full optimization summary
 * @param {string} filename - Filename (without extension)
 */
export function exportToJSON(optimizationData, filename = 'audio-optimization') {
  const exportData = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    ...optimizationData
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  downloadFile(jsonString, `${filename}.json`, 'application/json');
}

/**
 * Export just the settings (compact format for DAW use)
 * @param {Object} optimizationData - Full optimization summary
 * @param {string} filename - Filename (without extension)
 */
export function exportSettingsJSON(optimizationData, filename = 'daw-settings') {
  const settings = {
    genre: optimizationData.targetGenreName,
    eq: optimizationData.recommendations?.eq?.map(eq => ({
      band: eq.band,
      freq: eq.specificFrequency || eq.frequencyRange?.[0],
      gain: eq.recommendedChange,
      q: eq.q,
      type: eq.type
    })),
    compression: optimizationData.recommendations?.compression ? {
      threshold: optimizationData.recommendations.compression.threshold,
      ratio: optimizationData.recommendations.compression.ratio,
      attack: optimizationData.recommendations.compression.attack,
      release: optimizationData.recommendations.compression.release,
      makeup: optimizationData.recommendations.compression.makeupGain
    } : null,
    limiter: optimizationData.recommendations?.limiter ? {
      threshold: optimizationData.recommendations.limiter.threshold,
      ceiling: optimizationData.recommendations.limiter.ceiling,
      release: optimizationData.recommendations.limiter.release
    } : null,
    targetLUFS: optimizationData.targetMetrics?.lufs
  };

  const jsonString = JSON.stringify(settings, null, 2);
  downloadFile(jsonString, `${filename}.json`, 'application/json');
}

// ============================================
// PDF EXPORT
// ============================================

/**
 * Generate PDF report
 * Uses browser print functionality for compatibility
 * @param {Object} optimizationData - Full optimization summary
 * @param {string} filename - Filename (without extension)
 */
export function exportToPDF(optimizationData, filename = 'audio-optimization-report') {
  const htmlContent = generatePDFHTML(optimizationData);

  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Wait for styles to load, then print
  printWindow.onload = () => {
    printWindow.print();
  };
}

/**
 * Generate HTML content for PDF export
 * @param {Object} data - Optimization data
 * @returns {string} HTML string
 */
function generatePDFHTML(data) {
  const date = new Date().toLocaleDateString();

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Audio Optimization Report</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    h1 { color: #2563eb; margin-bottom: 0.5rem; }
    h2 { color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; margin-top: 2rem; }
    h3 { color: #4b5563; margin-top: 1.5rem; }
    .header { border-bottom: 3px solid #2563eb; padding-bottom: 1rem; margin-bottom: 2rem; }
    .subtitle { color: #6b7280; font-size: 0.9rem; }
    .score-box {
      display: inline-block;
      padding: 1rem 2rem;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      color: white;
      border-radius: 8px;
      margin: 1rem 0;
    }
    .score-value { font-size: 2rem; font-weight: bold; }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin: 1rem 0;
    }
    .metric-card {
      background: #f3f4f6;
      padding: 1rem;
      border-radius: 6px;
    }
    .metric-label { font-size: 0.8rem; color: #6b7280; text-transform: uppercase; }
    .metric-value { font-size: 1.25rem; font-weight: 600; color: #111827; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    th, td {
      text-align: left;
      padding: 0.75rem;
      border-bottom: 1px solid #e5e7eb;
    }
    th { background: #f9fafb; font-weight: 600; }
    .priority-high { color: #dc2626; font-weight: 600; }
    .priority-medium { color: #f59e0b; }
    .priority-low { color: #10b981; }
    .recommendation-box {
      background: #eff6ff;
      border-left: 4px solid #2563eb;
      padding: 1rem;
      margin: 0.5rem 0;
    }
    .settings-code {
      background: #1f2937;
      color: #f9fafb;
      padding: 1rem;
      border-radius: 6px;
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 0.85rem;
      overflow-x: auto;
    }
    .footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 0.8rem;
    }
    @media print {
      body { padding: 20px; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Audio Optimization Report</h1>
    <p class="subtitle">Generated on ${date} | Target Genre: ${data.targetGenreName || 'Auto-detected'} | Platform: ${data.platform || 'Spotify'}</p>
  </div>

  <section>
    <h2>Optimization Score</h2>
    <div class="score-box">
      <div class="score-value">${data.scores?.current || '--'} → ${data.scores?.potential || '--'}</div>
      <div>Current → Potential (+${data.scores?.improvement || 0} improvement)</div>
    </div>
  </section>

  <section>
    <h2>Current vs Target Metrics</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Integrated Loudness</div>
        <div class="metric-value">${formatNumber(data.currentMetrics?.lufs)} → ${formatNumber(data.targetMetrics?.lufs)} LUFS</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Dynamic Range</div>
        <div class="metric-value">${formatNumber(data.currentMetrics?.dynamicRange)} → ${formatNumber(data.targetMetrics?.dynamicRange)} dB</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">True Peak</div>
        <div class="metric-value">${formatNumber(data.currentMetrics?.truePeak)} → ${formatNumber(data.targetMetrics?.truePeak)} dBFS</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Stereo Width</div>
        <div class="metric-value">${formatNumber(data.currentMetrics?.stereoWidth)}%</div>
      </div>
    </div>
  </section>

  <section>
    <h2>Priority Actions</h2>
    ${data.priority?.map((p, i) => `
      <div class="recommendation-box">
        <strong class="priority-${p.order <= 2 ? 'high' : p.order <= 4 ? 'medium' : 'low'}">${i + 1}. ${p.category}</strong>
        <p style="margin: 0.5rem 0 0 0;">${p.action}</p>
        ${p.reason ? `<p style="margin: 0.25rem 0 0 0; color: #6b7280; font-size: 0.85rem;">${p.reason}</p>` : ''}
      </div>
    `).join('') || '<p>No priority actions needed</p>'}
  </section>

  <div class="page-break"></div>

  <section>
    <h2>EQ Recommendations</h2>
    <table>
      <thead>
        <tr>
          <th>Band</th>
          <th>Frequency</th>
          <th>Change</th>
          <th>Type</th>
          <th>Q</th>
          <th>Priority</th>
        </tr>
      </thead>
      <tbody>
        ${data.recommendations?.eq?.map(eq => `
          <tr>
            <td>${eq.band}</td>
            <td>${formatFrequency(eq.specificFrequency || eq.frequencyRange?.[0])}</td>
            <td>${eq.recommendedChange > 0 ? '+' : ''}${eq.recommendedChange} dB</td>
            <td>${eq.type || 'shelf'}</td>
            <td>${eq.q || '1.0'}</td>
            <td class="priority-${eq.priority}">${eq.priority}</td>
          </tr>
        `).join('') || '<tr><td colspan="6">No EQ adjustments needed</td></tr>'}
      </tbody>
    </table>
  </section>

  <section>
    <h2>Compression Settings</h2>
    ${data.recommendations?.compression ? `
      <table>
        <tr><th>Parameter</th><th>Recommended</th></tr>
        <tr><td>Threshold</td><td>${data.recommendations.compression.threshold} dB</td></tr>
        <tr><td>Ratio</td><td>${data.recommendations.compression.ratio}:1</td></tr>
        <tr><td>Attack</td><td>${data.recommendations.compression.attack} ms</td></tr>
        <tr><td>Release</td><td>${data.recommendations.compression.release} ms</td></tr>
        <tr><td>Makeup Gain</td><td>${data.recommendations.compression.makeupGain || 0} dB</td></tr>
        <tr><td>Knee</td><td>${data.recommendations.compression.knee || 3} dB (soft)</td></tr>
      </table>
      ${data.recommendations.compression.note ? `<p><em>${data.recommendations.compression.note}</em></p>` : ''}
    ` : '<p>No compression adjustments needed</p>'}
  </section>

  <section>
    <h2>Limiter Settings</h2>
    ${data.recommendations?.limiter ? `
      <table>
        <tr><th>Parameter</th><th>Recommended</th></tr>
        <tr><td>Threshold</td><td>${data.recommendations.limiter.threshold} dBFS</td></tr>
        <tr><td>Ceiling</td><td>${data.recommendations.limiter.ceiling} dBFS</td></tr>
        <tr><td>Release</td><td>${data.recommendations.limiter.release} ms</td></tr>
        <tr><td>Lookahead</td><td>${data.recommendations.limiter.lookahead || 5} ms</td></tr>
        <tr><td>Gain to Apply</td><td>+${data.recommendations.limiter.gainToApply?.toFixed(1) || 0} dB</td></tr>
      </table>
      ${data.recommendations.limiter.note ? `<p><em>${data.recommendations.limiter.note}</em></p>` : ''}
    ` : '<p>No limiter adjustments needed</p>'}
  </section>

  ${data.recommendations?.stereo?.issues?.length > 0 ? `
    <section>
      <h2>Stereo Issues</h2>
      ${data.recommendations.stereo.issues.map(issue => `
        <div class="recommendation-box">
          <strong class="priority-${issue.severity === 'severe' ? 'high' : issue.severity}">${issue.type}</strong>
          <p style="margin: 0.5rem 0 0 0;">${issue.description}</p>
        </div>
      `).join('')}
    </section>
  ` : ''}

  <section>
    <h2>DAW Quick Reference</h2>
    <div class="settings-code">
<pre>
// Compression
Threshold: ${data.recommendations?.compression?.threshold || '-8'} dB
Ratio: ${data.recommendations?.compression?.ratio || '3'}:1
Attack: ${data.recommendations?.compression?.attack || '15'} ms
Release: ${data.recommendations?.compression?.release || '150'} ms

// Limiter
Ceiling: ${data.recommendations?.limiter?.ceiling || '-1'} dBFS
Release: ${data.recommendations?.limiter?.release || '100'} ms

// Target: ${data.targetMetrics?.lufs || '-14'} LUFS
</pre>
    </div>
  </section>

  <div class="footer">
    <p>Generated by Music Analyzer - AI Audio Optimizer</p>
    <p>This report provides recommendations only. Always use your ears and reference tracks for final decisions.</p>
  </div>
</body>
</html>
  `;
}

// ============================================
// DAW-READY FORMAT
// ============================================

/**
 * Format settings for easy copy-paste into DAWs
 * @param {Object} optimizationData - Optimization data
 * @param {string} dawType - DAW type ('generic', 'ableton', 'logic', 'protools')
 * @returns {string} Formatted settings text
 */
export function formatForDAW(optimizationData, dawType = 'generic') {
  const comp = optimizationData.recommendations?.compression;
  const limiter = optimizationData.recommendations?.limiter;
  const eqBands = optimizationData.recommendations?.eq || [];

  let output = `=== Audio Optimization Settings ===\n`;
  output += `Genre: ${optimizationData.targetGenreName}\n`;
  output += `Target LUFS: ${optimizationData.targetMetrics?.lufs} LUFS\n\n`;

  // EQ Settings
  output += `--- EQ ---\n`;
  eqBands.filter(eq => eq.priority !== 'low' || eq.recommendedChange !== 0).forEach(eq => {
    const freq = eq.specificFrequency || eq.frequencyRange?.[0];
    output += `${eq.band}: ${formatFrequency(freq)}, ${eq.recommendedChange > 0 ? '+' : ''}${eq.recommendedChange}dB, Q=${eq.q || 1.0}, ${eq.type || 'bell'}\n`;
  });
  output += '\n';

  // Compression
  if (comp) {
    output += `--- Compression ---\n`;
    output += `Threshold: ${comp.threshold} dB\n`;
    output += `Ratio: ${comp.ratio}:1\n`;
    output += `Attack: ${comp.attack} ms\n`;
    output += `Release: ${comp.release} ms\n`;
    output += `Makeup: ${comp.makeupGain || 0} dB\n\n`;
  }

  // Limiter
  if (limiter) {
    output += `--- Limiter ---\n`;
    output += `Ceiling: ${limiter.ceiling} dBFS\n`;
    output += `Release: ${limiter.release} ms\n`;
    if (limiter.gainToApply > 0) {
      output += `Pre-Limiter Gain: +${limiter.gainToApply.toFixed(1)} dB\n`;
    }
  }

  // DAW-specific additions
  if (dawType === 'ableton') {
    output += `\n--- Ableton Live Notes ---\n`;
    output += `Use Glue Compressor for mix bus\n`;
    output += `Use EQ Eight with oversampling enabled\n`;
    output += `Limiter: Use Limiter device on Master\n`;
  } else if (dawType === 'logic') {
    output += `\n--- Logic Pro Notes ---\n`;
    output += `Use Channel EQ or Linear Phase EQ\n`;
    output += `Use Compressor with Platinum circuit\n`;
    output += `Adaptive Limiter for final limiting\n`;
  } else if (dawType === 'protools') {
    output += `\n--- Pro Tools Notes ---\n`;
    output += `Recommend: Avid Channel Strip or FabFilter Pro-Q\n`;
    output += `Use Dynamics III for compression\n`;
    output += `Maxim or L1 for limiting\n`;
  }

  return output;
}

/**
 * Copy settings to clipboard
 * @param {Object} optimizationData - Optimization data
 * @param {string} format - Format type ('json', 'daw', 'quick')
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(optimizationData, format = 'daw') {
  let text;

  switch (format) {
    case 'json':
      text = JSON.stringify(optimizationData, null, 2);
      break;
    case 'quick':
      text = formatQuickReference(optimizationData);
      break;
    case 'daw':
    default:
      text = formatForDAW(optimizationData, 'generic');
      break;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}

/**
 * Format quick reference (minimal format)
 * @param {Object} data - Optimization data
 * @returns {string} Quick reference text
 */
function formatQuickReference(data) {
  const comp = data.recommendations?.compression;
  const limiter = data.recommendations?.limiter;

  return `Target: ${data.targetMetrics?.lufs} LUFS | Comp: ${comp?.threshold}dB, ${comp?.ratio}:1 | Limiter: ${limiter?.ceiling}dBFS`;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Download file
 * @param {string} content - File content
 * @param {string} filename - Filename
 * @param {string} mimeType - MIME type
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Format number safely
 * @param {number} value - Value to format
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted number
 */
function formatNumber(value, decimals = 1) {
  if (value === undefined || value === null || isNaN(value)) return '--';
  return value.toFixed(decimals);
}

/**
 * Format frequency for display
 * @param {number} freq - Frequency in Hz
 * @returns {string} Formatted frequency
 */
function formatFrequency(freq) {
  if (!freq || isNaN(freq)) return '--';
  if (freq >= 1000) {
    return `${(freq / 1000).toFixed(1)}kHz`;
  }
  return `${Math.round(freq)}Hz`;
}

// ============================================
// BATCH EXPORT
// ============================================

/**
 * Export all formats at once
 * @param {Object} optimizationData - Optimization data
 * @param {string} baseFilename - Base filename
 */
export function exportAll(optimizationData, baseFilename = 'optimization') {
  exportToJSON(optimizationData, `${baseFilename}-full`);
  exportSettingsJSON(optimizationData, `${baseFilename}-settings`);

  // Create a text file with DAW settings
  const dawText = formatForDAW(optimizationData, 'generic');
  downloadFile(dawText, `${baseFilename}-daw.txt`, 'text/plain');
}

/**
 * Export comparison report (before/after)
 * @param {Object} beforeData - Before optimization metrics
 * @param {Object} afterData - After optimization metrics (or targets)
 * @param {string} filename - Filename
 */
export function exportComparisonReport(beforeData, afterData, filename = 'comparison-report') {
  const report = {
    exportDate: new Date().toISOString(),
    before: beforeData,
    after: afterData,
    improvements: {
      lufs: (afterData.lufs || 0) - (beforeData.lufs || 0),
      dynamicRange: (afterData.dynamicRange || 0) - (beforeData.dynamicRange || 0),
      score: (afterData.score || 0) - (beforeData.score || 0)
    }
  };

  const jsonString = JSON.stringify(report, null, 2);
  downloadFile(jsonString, `${filename}.json`, 'application/json');
}
