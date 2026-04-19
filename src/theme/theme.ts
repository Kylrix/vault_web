'use client';

import { createTheme, alpha } from '@mui/material/styles';
import type { ThemeOptions } from '@mui/material/styles';

const SURFACE_BACKGROUND = '#000000';
const SURFACE = '#161514';
const SURFACE_ELEVATED = '#1F1D1B';

const getDesignTokens = (): ThemeOptions => ({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366F1', // Electric Teal
      contrastText: '#000000',
    },
    secondary: {
      main: '#10B981', // Atomic Emerald
    },
    background: {
      default: SURFACE_BACKGROUND,
      paper: SURFACE,
    },
    text: {
      primary: '#F2F2F2',   // Titanium
      secondary: '#A1A1AA', // Gunmetal
      disabled: '#404040',  // Carbon
    },
    divider: 'rgba(255, 255, 255, 0.05)', // Subtle Border
  },
  typography: {
    fontFamily: 'var(--font-satoshi), "Satoshi", sans-serif',
    h1: {
      fontFamily: 'var(--font-clash), "Clash Display", sans-serif',
      fontSize: '3.5rem',
      fontWeight: 900,
      letterSpacing: '-0.04em',
      color: '#F2F2F2',
    },
    h2: {
      fontFamily: 'var(--font-clash), "Clash Display", sans-serif',
      fontSize: '2.5rem',
      fontWeight: 900,
      letterSpacing: '-0.03em',
    },
    h3: {
      fontFamily: 'var(--font-clash), "Clash Display", sans-serif',
      fontSize: '2rem',
      fontWeight: 800,
      letterSpacing: '-0.02em',
    },
    h4: {
      fontFamily: 'var(--font-clash), "Clash Display", sans-serif',
      fontSize: '1.5rem',
      fontWeight: 800,
    },
    h5: {
      fontFamily: 'var(--font-clash), "Clash Display", sans-serif',
      fontSize: '1.25rem',
      fontWeight: 800,
    },
    h6: {
      fontFamily: 'var(--font-clash), "Clash Display", sans-serif',
      fontSize: '1.1rem',
      fontWeight: 800,
    },
    body1: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      fontWeight: 400,
    },
    caption: {
      fontSize: '0.75rem',
      color: '#A1A1AA',
    },
    button: {
      fontFamily: 'var(--font-clash), "Clash Display", sans-serif',
      textTransform: 'none',
      fontWeight: 700,
    },
  },
  shape: {
    borderRadius: 16,
  },
  shadows: Array(25).fill('none') as any,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: SURFACE_BACKGROUND,
          color: '#F2F2F2',
          scrollbarColor: '#222222 transparent',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            width: 6,
            height: 6,
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 12,
            backgroundColor: '#222222',
            '&:hover': {
              backgroundColor: '#404040',
            },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '10px 20px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
          },
          '&:hover': {
            borderColor: 'rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
          },
          '&:active': {
            transform: 'scale(0.98)',
          },
        },
        containedPrimary: {
          backgroundColor: '#6366F1',
          color: '#000000',
          border: 'none',
          fontWeight: 800,
          boxShadow: '0 1px 0 rgba(0, 0, 0, 0.4)',
          '&::before': {
            background: 'rgba(255, 255, 255, 0.15)',
          },
          '&:hover': {
            backgroundColor: 'rgba(99, 102, 241, 0.8)',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.2), 0 1px 0 rgba(0, 0, 0, 0.4)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 24,
          backgroundColor: SURFACE,
          border: '1px solid rgba(255, 255, 255, 0.05)',
          backgroundImage: 'none',
          position: 'relative',
          boxShadow: '0 1px 0 rgba(0, 0, 0, 0.4)',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '24px',
          },
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            borderColor: 'rgba(99, 102, 241, 0.2)',
            transform: 'translateY(-2px)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 1px 0 rgba(0, 0, 0, 0.4)'
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: SURFACE,
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '0 1px 0 rgba(0, 0, 0, 0.4)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(11, 9, 8, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: 'none',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 24,
          backgroundColor: SURFACE_ELEVATED,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundImage: 'none',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 1px 0 rgba(0, 0, 0, 0.4)',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '24px',
          },
        },
      },
    },
  },
});

export const darkTheme = createTheme(getDesignTokens());
export default darkTheme;
