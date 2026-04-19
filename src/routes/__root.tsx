import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/router-core';
import type { ReactNode } from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import appCss from '../globals.css?url';

export const Route = createRootRoute({
  errorComponent: RootErrorComponent,
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Kylrix Vault' },
      { name: 'description', content: 'Kylrix Vault on TanStack Start.' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'preconnect', href: 'https://fra.cloud.appwrite.io' },
      { rel: 'stylesheet', href: 'https://api.fontshare.com/v2/css?f[]=clash-display@200,300,400,500,600,700&f[]=satoshi@300,400,500,700,900&display=swap' },
    ],
  }),
  shellComponent: RootDocument,
});

function RootErrorComponent({ error, info, reset }: ErrorComponentProps) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000', color: '#fff', p: 3 }}>
      <Paper sx={{ p: 3, bgcolor: '#161412', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Stack spacing={2}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>App error</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>{error.message}</Typography>
          <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontSize: 12, fontFamily: 'monospace', color: 'rgba(255,255,255,0.75)' }}>
            {error.stack}
            {'\n'}
            {info?.componentStack}
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={reset}>Retry</Button>
            <Button variant="outlined" onClick={() => window.location.reload()}>Reload</Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body>
        <div style={{ minHeight: '100vh', width: '100%', background: '#000' }}>
          {children}
        </div>
        <Scripts />
      </body>
    </html>
  );
}
