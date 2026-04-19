"use client";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export default function LandingPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000', color: '#fff' }}>
      <Container maxWidth="md" sx={{ py: 10 }}>
        <Paper sx={{ p: 4, bgcolor: '#161412', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Stack spacing={2}>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>
              Kylrix Vault
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Vault dev workspace is running.
            </Typography>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
