import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import api from '../../lib/api.js';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const PREVIEW_TIMEOUT_MS = 180000;

const QUICK_SEARCHES = [
  { label: 'Payoneer', value: 'payoneer' },
  { label: 'Automatic withdrawal', value: 'automatic withdrawal' },
  { label: 'Unread only', value: 'unread' },
];

function statusChip(status) {
  if (status === 'ready') return <Chip size="small" color="success" label="Ready" />;
  return <Chip size="small" color="default" variant="outlined" label="Skipped" />;
}

function messageMatchesSearch(m, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    m.from,
    m.subject,
    m.bodyPreview,
    m.skipReason,
    m.status,
    m.parsedAmount != null ? String(m.parsedAmount) : '',
    m.parsedDate ? new Date(m.parsedDate).toLocaleString() : '',
    m.internalDate ? new Date(m.internalDate).toLocaleString() : '',
    m.seen ? 'read' : 'unread',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

export default function GmailTesterPage() {
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [previewLimit, setPreviewLimit] = useState(500);
  const [importLimit, setImportLimit] = useState(25);
  const [mode, setMode] = useState('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('payoneer');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [report, setReport] = useState(null);
  const [selectedUid, setSelectedUid] = useState(null);
  const [copyStatus, setCopyStatus] = useState('');

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const { data } = await api.get('/gmail-test/status');
      setStatus(data);
      setError((prev) => (prev && prev.includes('Failed to load Gmail status') ? '' : prev));
    } catch (e) {
      setStatus(null);
      setError(e?.response?.data?.error || e?.message || 'Failed to load Gmail status');
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const filteredMessages = useMemo(() => {
    const list = report?.messages || [];
    return list.filter((m) => {
      if (statusFilter === 'ready' && m.status !== 'ready') return false;
      if (statusFilter === 'skipped' && m.status !== 'skipped') return false;
      if (statusFilter === 'payoneer' && (!m.senderAllowed || !m.subjectAllowed)) return false;
      if (statusFilter === 'unread' && m.seen) return false;
      return messageMatchesSearch(m, search);
    });
  }, [report, search, statusFilter]);

  const selectedMessage = useMemo(
    () => filteredMessages.find((m) => m.uid === selectedUid) || filteredMessages[0] || null,
    [filteredMessages, selectedUid]
  );

  useEffect(() => {
    if (!filteredMessages.length) {
      setSelectedUid(null);
      return;
    }
    if (!filteredMessages.some((m) => m.uid === selectedUid)) {
      setSelectedUid(filteredMessages[0].uid);
    }
  }, [filteredMessages, selectedUid]);

  const runPreview = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    setReport(null);
    try {
      const { data } = await api.post(
        '/gmail-test/preview',
        {
          limit: Number(previewLimit) || 500,
          mode,
        },
        { timeout: PREVIEW_TIMEOUT_MS }
      );
      setReport(data);
      if (data?.messages?.length) setSelectedUid(data.messages[0].uid);
    } catch (e) {
      const isTimeout = e?.code === 'ECONNABORTED';
      setError(
        (e?.response?.data?.error || e?.message || 'Preview failed') +
          (isTimeout ? ' Try a lower max messages or use “Latest N only”.' : '')
      );
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    if (
      !window.confirm(
        `Import up to ${importLimit} unread Payoneer emails as Credit transactions on “${status?.bankAccount?.name || 'bank account'}”? Already-imported mail is skipped.`
      )
    ) {
      return;
    }
    setImporting(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.post('/gmail-test/import', {
        limit: Number(importLimit) || 25,
      });
      setSuccess(
        `Import done: scanned ${data?.scanned ?? 0}, imported ${data?.imported ?? 0}, skipped ${data?.skipped ?? 0}` +
          (data?.bankAccount ? ` → ${data.bankAccount}` : '')
      );
      await runPreview();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const copyBody = async () => {
    if (!selectedMessage?.bodyPreview) return;
    try {
      await navigator.clipboard.writeText(selectedMessage.bodyPreview);
      setCopyStatus('Copied');
    } catch {
      setCopyStatus('Copy failed');
    }
    setTimeout(() => setCopyStatus(''), 2000);
  };

  const payoneerReadyCount = useMemo(() => {
    if (!report?.messages) return 0;
    return report.messages.filter(
      (m) => m.status === 'ready' && m.senderAllowed && m.subjectAllowed && !m.seen
    ).length;
  }, [report]);

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h4" sx={{ mb: 0.5 }}>
            Gmail Tester
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Preview Payoneer withdrawal emails before they become bank credits on{' '}
            <Link component={RouterLink} to="/admin/transactions">
              Transactions
            </Link>
            . Server filters sender and subject via env — not editable here.
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={statusLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={loadStatus}
          disabled={statusLoading}
        >
          Refresh status
        </Button>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      ) : null}

      <StatusPanel status={status} apiBase={API_BASE} />

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
          1. Fetch inbox → 2. Search / filter → 3. Check parsed amount → 4. Import unread credits
        </Typography>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ md: 'flex-end' }}
            flexWrap="wrap"
            useFlexGap
          >
            <TextField
              size="small"
              type="number"
              label="Max messages (preview)"
              value={previewLimit}
              onChange={(e) => setPreviewLimit(e.target.value)}
              inputProps={{ min: 1, max: 2000 }}
              helperText="Up to 2000"
              sx={{ width: { xs: '100%', sm: 170 } }}
            />
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 280 } }}>
              <InputLabel id="gmail-mode-label">Inbox scan</InputLabel>
              <Select
                labelId="gmail-mode-label"
                label="Inbox scan"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <MenuItem value="all">All inbox (read + unread)</MenuItem>
                <MenuItem value="recent">Latest N only</MenuItem>
                <MenuItem value="unread">Unread only (same as import)</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <MailOutlineIcon />}
              onClick={runPreview}
              disabled={loading || !status?.imapConfigured}
            >
              {loading ? 'Fetching…' : 'Fetch mail'}
            </Button>
          </Stack>

          <Divider />

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ md: 'flex-end' }}
            flexWrap="wrap"
            useFlexGap
          >
            <TextField
              size="small"
              type="number"
              label="Import limit"
              value={importLimit}
              onChange={(e) => setImportLimit(e.target.value)}
              inputProps={{ min: 1, max: 100 }}
              helperText="Unread only, max 100"
              sx={{ width: { xs: '100%', sm: 140 } }}
            />
            <Button
              variant="outlined"
              color="secondary"
              onClick={runImport}
              disabled={importing || !status?.imapConfigured || !status?.bankAccount}
            >
              {importing ? 'Importing…' : 'Import credits (unread)'}
            </Button>
            {status?.imapConfigured && status?.bankAccount && payoneerReadyCount > 0 && !report ? (
              <Typography variant="caption" color="text.secondary">
                Fetch mail first to see how many rows are ready.
              </Typography>
            ) : null}
            {report && payoneerReadyCount > 0 ? (
              <Chip
                size="small"
                color="success"
                variant="outlined"
                label={`${payoneerReadyCount} unread Payoneer-ready`}
              />
            ) : null}
          </Stack>

          {report ? (
            <>
              <Divider />
              <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Search from, subject, body, amount, skip reason…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                  />
                  <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
                    <InputLabel id="gmail-status-filter">Show</InputLabel>
                    <Select
                      labelId="gmail-status-filter"
                      label="Show"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <MenuItem value="payoneer">Payoneer match (sender + subject)</MenuItem>
                      <MenuItem value="all">All fetched</MenuItem>
                      <MenuItem value="ready">Ready to import</MenuItem>
                      <MenuItem value="skipped">Skipped</MenuItem>
                      <MenuItem value="unread">Unread only</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {QUICK_SEARCHES.map((q) => (
                    <Chip
                      key={q.value}
                      size="small"
                      label={q.label}
                      variant={search === q.value ? 'filled' : 'outlined'}
                      onClick={() => setSearch(q.value)}
                      clickable
                    />
                  ))}
                  {search ? (
                    <Chip size="small" label="Clear search" onClick={() => setSearch('')} clickable />
                  ) : null}
                </Stack>
              </Stack>
            </>
          ) : null}
        </Stack>
      </Paper>

      {report ? (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            <Chip label={`Inbox: ${report.inboxTotal ?? '?'}`} />
            <Chip label={`Fetched: ${report.scanned}`} />
            <Chip label={`Showing: ${filteredMessages.length}`} color="primary" variant="outlined" />
            <Chip color="success" label={`Ready: ${report.ready ?? 0}`} />
            <Chip label={`Skipped: ${report.skipped ?? 0}`} />
            <Chip variant="outlined" label={`Scan: ${report.mode}`} />
            {report.bankAccount?.name ? (
              <Chip variant="outlined" label={`Bank: ${report.bankAccount.name}`} />
            ) : null}
          </Stack>

          <MailResultsLayout
            messages={filteredMessages}
            totalFetched={report.messages?.length ?? 0}
            selectedUid={selectedUid}
            onSelect={setSelectedUid}
            selectedMessage={selectedMessage}
            copyStatus={copyStatus}
            onCopyBody={copyBody}
          />
        </Stack>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <MailOutlineIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            Click <strong>Fetch mail</strong> to load inbox messages from the API server.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Default filter after fetch: Payoneer sender + subject. Large inboxes may take up to a few
            minutes.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

function StatusPanel({ status, apiBase }) {
  if (!status) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        Could not load Gmail status from <code>{apiBase}</code>. Is the API running?
      </Alert>
    );
  }

  if (!status.imapConfigured) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        Gmail IMAP is not configured on the API host. On <strong>Render</strong> (API service, not
        Vercel), set <code>GMAIL_IMAP_USER</code> and <code>GMAIL_IMAP_APP_PASSWORD</code> (Google App
        Password with 2FA), then <strong>Manual Deploy</strong>. Local: add the same to{' '}
        <code>Back/.env</code> and restart <code>npm run dev</code>.
      </Alert>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
      <Stack spacing={1.5}>
        <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
          <Chip size="small" color="success" label="IMAP connected" />
          <Typography variant="body2">
            <strong>{status.imapUserMasked}</strong> @ {status.imapHost}:{status.imapPort}
          </Typography>
        </Stack>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {status.bankAccount ? (
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={`Credits → ${status.bankAccount.name}`}
            />
          ) : (
            <Chip
              size="small"
              color="warning"
              label="No bank account — set GMAIL_IMPORT_BANK_ACCOUNT_NAME"
            />
          )}
          <Chip
            size="small"
            variant="outlined"
            label={`Cron: ${status.cronEnabled ? status.cronExpr : 'off (manual import)'}`}
          />
        </Stack>
        <Box>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            Server filters (env)
          </Typography>
          <Typography variant="body2" component="div">
            <strong>Senders:</strong>{' '}
            {status.allowedSenders?.length ? status.allowedSenders.join(', ') : '(any — not recommended)'}
          </Typography>
          <Typography variant="body2" component="div">
            <strong>Subjects:</strong>{' '}
            {status.allowedSubjects?.length
              ? status.allowedSubjects.join(' | ')
              : '(any — not recommended)'}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          API: <code>{apiBase}</code> · Import only processes <strong>unread</strong> mail that passes
          these filters.
        </Typography>
      </Stack>
    </Paper>
  );
}

function MailResultsLayout({
  messages,
  totalFetched,
  selectedUid,
  onSelect,
  selectedMessage,
  copyStatus,
  onCopyBody,
}) {
  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="stretch">
      <Paper sx={{ flex: 1.2, overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 560 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell width={88}>Status</TableCell>
                <TableCell>From / subject</TableCell>
                <TableCell width={100}>Amount</TableCell>
                <TableCell width={150}>Received</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(messages || []).map((m) => (
                <TableRow
                  key={m.uid}
                  hover
                  selected={m.uid === selectedUid}
                  onClick={() => onSelect(m.uid)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Stack spacing={0.5}>
                      {statusChip(m.status)}
                      <Chip
                        size="small"
                        label={m.seen ? 'Read' : 'Unread'}
                        color={m.seen ? 'default' : 'info'}
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.65rem' }}
                      />
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 280 }}>
                    <Typography variant="body2" noWrap title={m.from}>
                      {m.from}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                      title={m.subject}
                    >
                      {m.subject || '(no subject)'}
                    </Typography>
                    {m.skipReason ? (
                      <Tooltip title={m.skipReason}>
                        <Typography variant="caption" color="warning.main" noWrap display="block">
                          {m.skipReason}
                        </Typography>
                      </Tooltip>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {m.parsedAmount != null ? (
                      <Typography variant="body2" fontWeight={600}>
                        {m.parsedAmount}
                      </Typography>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" display="block">
                      {formatWhen(m.internalDate)}
                    </Typography>
                    {m.parsedDate ? (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Parsed: {formatWhen(m.parsedDate)}
                      </Typography>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {!messages?.length ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    {totalFetched > 0
                      ? 'No messages match your search or filter. Try “All fetched” or clear search.'
                      : 'No messages in this scan.'}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ flex: 1, p: 2, minHeight: 320 }}>
        {selectedMessage ? (
          <Stack spacing={1.5}>
            <Typography variant="h6">Message detail</Typography>
            <Typography variant="body2">
              <strong>Subject:</strong> {selectedMessage.subject || '(none)'}
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
              <strong>From:</strong> {selectedMessage.from}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={selectedMessage.seen ? 'Read' : 'Unread'} />
              {selectedMessage.alreadyProcessed ? (
                <Chip size="small" color="warning" label="Already imported" />
              ) : null}
              {selectedMessage.senderAllowed && selectedMessage.subjectAllowed ? (
                <Chip size="small" color="info" label="Payoneer rules OK" />
              ) : null}
              {!selectedMessage.senderAllowed ? (
                <Chip size="small" color="error" label="Sender blocked" />
              ) : null}
              {!selectedMessage.subjectAllowed ? (
                <Chip size="small" color="error" label="Subject blocked" />
              ) : null}
              {selectedMessage.status === 'ready' && !selectedMessage.seen ? (
                <Chip size="small" color="success" label="Will import on next run" />
              ) : null}
            </Stack>
            {selectedMessage.skipReason ? (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                {selectedMessage.skipReason}
              </Alert>
            ) : null}
            <Divider />
            <Typography variant="subtitle2">Parsed for Transactions</Typography>
            <Stack direction="row" spacing={3}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Amount (INR)
                </Typography>
                <Typography variant="h6">{selectedMessage.parsedAmount ?? '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Date
                </Typography>
                <Typography variant="body1">{formatWhen(selectedMessage.parsedDate)}</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2">Body preview</Typography>
              <Button size="small" startIcon={<ContentCopyIcon />} onClick={onCopyBody}>
                Copy
              </Button>
              {copyStatus ? (
                <Typography variant="caption" color="text.secondary">
                  {copyStatus}
                </Typography>
              ) : null}
            </Stack>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                maxHeight: 360,
                overflow: 'auto',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.8rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {selectedMessage.bodyPreview || '(empty)'}
            </Paper>
          </Stack>
        ) : (
          <Typography color="text.secondary" sx={{ pt: 4, textAlign: 'center' }}>
            Select a row to inspect parsing and skip reasons.
          </Typography>
        )}
      </Paper>
    </Stack>
  );
}
