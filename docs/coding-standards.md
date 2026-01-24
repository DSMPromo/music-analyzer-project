# Coding Standards

## JavaScript/React
- **Style**: Functional components with hooks
- **Naming**:
  - Components: PascalCase (e.g., `AudioInputManager.tsx`)
  - Hooks: camelCase with `use` prefix (e.g., `useAudioContext`)
  - Files: Match component names
- **Formatting**:
  - 2-space indentation
  - Semicolons required
  - Single quotes for strings
  - ES6+ features (arrow functions, destructuring, async/await)
- **React Patterns**:
  - Use functional components exclusively
  - Custom hooks for reusable logic
  - PropTypes or TypeScript interfaces for props
  - Avoid inline functions in JSX when possible

## Node.js/Express
- **API Design**: RESTful endpoints under `/api/`
- **Error Handling**: Always use try-catch with proper error responses
- **Async**: Prefer async/await over callbacks
- **Security**: Validate all inputs, sanitize file paths

## Python
- **Style**: PEP 8 compliance
- **Functions**: Type hints for parameters and returns
- **Error Handling**: Use try-except with specific exceptions

## General
- **Comments**: Explain "why" not "what"
- **File Organization**: Group by feature, not type
- **Git**: Conventional commits (feat:, fix:, docs:, etc.)
- **Dependencies**: Keep minimal, prefer well-maintained packages

---

## File Size Guidelines

Keep files small for maintainability and AI tool compatibility.

| File Type | Target | Max | Action if exceeded |
|-----------|--------|-----|-------------------|
| Components | 200 lines | 500 lines | Split into sub-components |
| Hooks | 150 lines | 300 lines | Extract utilities |
| Utils | 200 lines | 400 lines | Split by function group |
| Python | 500 lines | 1000 lines | Split into modules |
| CSS | 500 lines | 1000 lines | Split by component |
| Docs | 300 lines | 500 lines | Split by topic |

### When to Split

- **Components**: Extract child components, move logic to hooks
- **Hooks**: Move helpers to utils, create specialized hooks
- **Python backends**: Create modules (e.g., `drum_classifier.py`, `beat_detection.py`)
- **CSS**: Use component-specific CSS files or CSS modules

### Token Limits (Claude Code)

- **Max readable**: 25,000 tokens (~1,500 lines)
- **Ideal**: 15,000 tokens (~500 lines)
- Files over 1,000 lines should be split proactively

---

## Large File Handling
When reading files that exceed 25000 tokens (e.g., App.css), use these strategies:

1. **Use offset and limit parameters** - Read specific portions of the file:
   ```
   Read(file_path, offset=100, limit=50)  # Read lines 100-150
   ```

2. **Use GrepTool first** - Search for specific content to find line numbers:
   ```
   Grep(pattern=".my-class", path="App.css")  # Find where styles are defined
   ```

3. **Split into sections** - When editing large files:
   - First use Grep to locate the target section
   - Then use Read with offset/limit to view context
   - Make targeted edits to specific sections
