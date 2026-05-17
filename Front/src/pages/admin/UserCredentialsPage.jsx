import { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

function loadCredentials() {
  try {
    const saved = localStorage.getItem('userCredentials');
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCredentials(list) {
  if (!list.length) {
    localStorage.removeItem('userCredentials');
  } else {
    localStorage.setItem('userCredentials', JSON.stringify(list));
  }
}

export default function UserCredentialsPage() {
  const [credentials, setCredentials] = useState(loadCredentials);

  const persist = (list) => {
    setCredentials(list);
    saveCredentials(list);
  };

  const handleDelete = (index) => {
    const row = credentials[index];
    const label = row?.username || row?.email || 'this entry';
    if (!window.confirm(`Remove "${label}" from this list?`)) return;
    persist(credentials.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    if (!credentials.length) return;
    if (!window.confirm('Clear all saved credentials from this browser? This does not delete user accounts.')) return;
    persist([]);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Typography variant="h6">User Credentials</Typography>
        {credentials.length > 0 && (
          <Button variant="outlined" color="error" size="small" onClick={handleClearAll}>
            Clear all
          </Button>
        )}
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Local record of usernames/passwords saved when you use <strong>Add User</strong>. Deleting here only
        removes them from this browser — it does not delete the user account on the server.
      </Alert>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Password</TableCell>
              <TableCell>Created At</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {credentials.map((cred, index) => (
              <TableRow key={`${cred.username}-${cred.createdAt}-${index}`}>
                <TableCell>{cred.email || '—'}</TableCell>
                <TableCell>{cred.username || '—'}</TableCell>
                <TableCell>
                  <Chip
                    label={cred.role || '—'}
                    color={
                      cred.role === 'superadmin' ? 'error' :
                      cred.role === 'listingadmin' ? 'primary' :
                      cred.role === 'productadmin' ? 'secondary' :
                      'default'
                    }
                    size="small"
                  />
                </TableCell>
                <TableCell>{cred.password || '—'}</TableCell>
                <TableCell>
                  {cred.createdAt ? new Date(cred.createdAt).toLocaleString() : '—'}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Remove from list">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(index)}
                      aria-label="Delete credential entry"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {credentials.length === 0 && (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          No user credentials saved yet. They appear here when new users are created via Add User on this browser.
        </Typography>
      )}
    </Box>
  );
}
