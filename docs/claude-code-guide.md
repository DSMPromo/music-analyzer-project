# Claude Code Best Practices Guide

Optimize your interactions with Claude Code for faster responses and lower token usage.

---

## Token Optimization

### File Size Limits

| Limit | Recommendation |
|-------|----------------|
| Max readable | 25,000 tokens (~1,500 lines) |
| Ideal size | 500 lines / 15k tokens |
| Split threshold | When file exceeds 1,000 lines |

**When a file is too large:**
1. Split into logical modules (see TICKET-043 for rhythm_analyzer.py)
2. Use `offset` and `limit` parameters to read portions
3. Use grep/glob to find specific content first

### .claudeignore

The `.claudeignore` file excludes files from Claude's context:

```
# Already excluded:
node_modules/     # Dependencies
venv/             # Python env
logs/             # Log files
*.mp3, *.wav      # Audio files
package-lock.json # Lock files
archive/          # Old files
```

Add project-specific exclusions as needed.

---

## Communication Efficiency

### Be Specific

**Good:**
```
Fix the hi-hat detection threshold in rhythm_analyzer.py:423
```

**Bad:**
```
The drum detection isn't working well, can you fix it?
```

### Reference Code Locations

Use `file:line` format:
- "Update the API call in `geminiAnalysis.js:87`"
- "The bug is in `useRhythmAnalysis.js:156-162`"

### Batch Related Changes

**Good:** "Update all panel components to use the new color scheme"

**Bad:** Asking for each panel separately in 4 different messages

### Search Before Reading

```
# Find where a function is defined
grep "function detectHiHat"

# Find files matching a pattern
glob "**/*Detection*.js"

# Then read only the relevant file
```

---

## Project Organization

### Documentation Structure

```
CLAUDE.md              # Concise index (keep under 200 lines)
docs/
├── quick-reference.md # Common commands
├── claude-code-guide.md # This file
├── file-structure.md  # Directory layout
├── services.md        # Backend APIs
├── audio-processing.md # Detection algorithms
└── ...
```

**Rules:**
- CLAUDE.md = table of contents only
- Each doc focused on ONE topic
- Keep docs under 500 lines

### Code Organization

```
components/
├── analysis/    # Group by feature
├── audio/
├── rhythm/
└── ...

# NOT:
components/
├── buttons/     # Don't group by type
├── panels/
├── modals/
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Component | PascalCase | `AudioAnalyzer.js` |
| Hook | camelCase + use | `useRhythmAnalysis.js` |
| Utility | camelCase | `audioUtils.js` |
| Test | *.test.js | `AudioAnalyzer.test.js` |

---

## Effective Requests

### Task Types

| Task | How to Ask |
|------|------------|
| Bug fix | "Fix [specific issue] in [file:line]. Expected: X, Actual: Y" |
| Feature | "Add [feature] to [component]. It should [behavior]." |
| Refactor | "Split [file] into [modules]. Keep API compatible." |
| Research | "Find where [X] is implemented. Don't modify yet." |

### Context Hints

Include relevant context:
- "This is a React component using hooks"
- "The backend is Python Flask on port 56403"
- "Tests are in `__tests__/` using Jest"

### Iterative Development

1. **Plan first**: "How should we implement X?"
2. **Implement**: "Go ahead with option 2"
3. **Test**: "Run the tests"
4. **Refine**: "The edge case for Y isn't handled"

---

## Caching Strategies

### AI Analysis Caching (TICKET-041)

For expensive AI operations:
```
data/ai-cache/
├── rhythm/          # Gemini rhythm hints
├── mix-analysis/    # Mix analysis results
└── index.json       # Cache metadata
```

Cache key = SHA256(file + model + prompt)

### Avoid Re-reading

If you've already read a file in this conversation:
- Reference it by name
- Ask for specific line ranges if needed
- Don't request full file again

---

## Common Patterns

### Adding a New Component

```bash
# 1. Create in appropriate feature folder
client/src/components/[feature]/NewComponent.js

# 2. Add test
client/src/__tests__/components/NewComponent.test.js

# 3. Export from index if folder has one
# 4. Import in App.js or parent component
```

### Splitting a Large File

```bash
# 1. Identify logical modules
# 2. Create new files in same folder
# 3. Move code with imports
# 4. Create index.js for clean exports
# 5. Update all import paths
# 6. Run tests to verify
```

### Creating a Ticket

```bash
curl -X POST http://localhost:56404/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Short descriptive title",
    "description": "Detailed description with context",
    "priority": "Critical|High|Medium|Low",
    "component": "Rhythm Detection|Audio Analysis|...",
    "status": "OPEN"
  }'
```

---

## Troubleshooting

### "File too large to read"

```bash
# Option 1: Read portion
Read(file, offset=100, limit=200)

# Option 2: Search first
Grep("functionName", file)
# Then read around that line

# Option 3: Split file (long-term fix)
```

### "Context window full"

- Start a new conversation
- Reference previous work: "Continue from TICKET-XXX"
- Use concise summaries of prior context

### "Tests failing after changes"

```bash
# Run specific test
npm test -- --testPathPattern="ComponentName"

# Check import paths
grep -r "from '.*ComponentName'" client/src/
```

---

## Quick Reference

### Commands

| Action | Command |
|--------|---------|
| Start services | `./start-services.sh` |
| Stop services | `./stop-services.sh` |
| Run tests | `cd client && npm test` |
| Create ticket | `curl -X POST localhost:56404/api/tickets ...` |

### Ports

| Service | Port |
|---------|------|
| React | 56400 |
| Gemini | 56401 |
| Stem | 56402 |
| Rhythm | 56403 |
| Express | 56404 |

### File Limits

| Type | Limit |
|------|-------|
| Readable | 25k tokens |
| Ideal | 15k tokens |
| Split at | 1000+ lines |

---

*Last updated: 2026-01-24*
