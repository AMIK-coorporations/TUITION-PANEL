// ============================================
// Thin re-export. The implementation lives in ../context/ThemeContext.tsx so
// that exactly one module owns theme state.
//
// NOTE: a sibling `useTheme.ts` with the same basename also exists. Both are
// identical re-exports on purpose: TypeScript/Vite resolution order between
// `.ts` and `.tsx` for the same basename is ambiguous, and this guarantees the
// same single implementation is used whichever file is picked.
// ============================================

export { ThemeProvider, useTheme } from '../context/ThemeContext';
export type { ThemeMode } from '../context/ThemeContext';