import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
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
      // The app's standard data pattern is `useEffect(() => { load() }, [dep])`
      // where load() awaits Supabase and then setStates. The rule flags every
      // such loader even though the setState happens after an await, so it is
      // noise here rather than a cascading-render catch.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
