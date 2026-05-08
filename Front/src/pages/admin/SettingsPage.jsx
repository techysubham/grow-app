import { Box, Paper, Typography } from '@mui/material';

export default function SettingsPage() {
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Settings
      </Typography>
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="body1" color="text.secondary">
          Settings page is ready.
        </Typography>
      </Paper>
    </Box>
  );
}
