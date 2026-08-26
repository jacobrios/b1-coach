import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `design/` holds the original HTML mockups and one stray JSX frame from the
  // design tool. They are artifacts of how this was designed, kept on purpose,
  // and they are not part of the app: nothing imports them and they are never
  // built. Linting them as application source produced 8 of the repo's 30
  // errors and none of them meant anything.
  globalIgnores(['dist', 'design']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // A parameter named with a leading underscore is unused on purpose. The
      // case this exists for is `scripts/claimVerdict.js`, where five verdict
      // handlers share one `(claim, session, context)` signature and are
      // dispatched identically; two read `context` and three do not. Dropping
      // the parameter from the three would break a uniform contract to satisfy
      // a linter, which is the wrong trade.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Everything that runs in Node rather than in a browser: the serverless
    // function, the hand-run scripts and their tests, the Claude Code hooks,
    // and the build config itself. Before this block they were linted as
    // browser code, so every `process` and `Buffer` reference read as an
    // undefined global. That was 13 of the repo's 30 errors and every one of
    // them was the config being wrong rather than the code.
    files: [
      'api/**/*.js',
      'scripts/**/*.{js,mjs}',
      '.claude/hooks/**/*.{js,mjs}',
      '*.config.js',
      '**/*.mjs',
    ],
    languageOptions: { globals: globals.node },
  },
])
