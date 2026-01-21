// Claude Analysis Service

export async function analyzeWithClaude(data) {
  const response = await fetch('/api/claude/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chordProgression: data.chordProgression,
      key: data.key,
      tempo: data.tempo,
      structure: data.structure,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Analysis failed');
  }

  const result = await response.json();
  return result.suggestions;
}

export async function getSuggestions(data, options = {}) {
  const response = await fetch('/api/claude/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chords: data.chords,
      key: data.key,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to get suggestions');
  }

  const result = await response.json();
  let suggestions = result.suggestions || [];

  if (options.filterType) {
    suggestions = suggestions.filter(s => s.type === options.filterType);
  }

  return suggestions;
}
