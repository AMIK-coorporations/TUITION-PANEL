// ============================================
// Thin re-export. The implementation lives in ../context/ThemeContext.tsx so
// that there is exactly one module owning theme state.
//
// NOTE: a sibling `useTheme.tsx` with the same basename also exists; both are
// intentionally identical re-exports so either import path resolves to the
// same single implementation.
// ============================================

export { ThemeProvider, useTheme } from '../context/ThemeContext';
export type { ThemeMode } from '../context/ThemeContext';