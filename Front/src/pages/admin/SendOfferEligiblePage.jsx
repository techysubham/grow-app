import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../../lib/api';

function suggestOfferPrice(item) {
  if (typeof item?.price === 'number' && item.price > 0) return item.price.toFixed(2);
  if (typeof item?.minimumOfferPrice === 'number' && item.minimumOfferPrice > 0) {
    return item.minimumOfferPrice.toFixed(2);
  }
  if (item?.listingPrice != null && !Number.isNaN(Number(item.listingPrice))) {
    return Number(item.listingPrice).toFixed(2);
  }
  return '';
}

export default function SendOfferEligiblePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sellerIdFromUrl = searchParams.get('sellerId') || '';

  const [loading, setLoading] = useState(false);
  const [eligibleItems, setEligibleItems] = useState([]);
  const [eligibleSummary, setEligibleSummary] = useState({ stores: 0, totalItems: 0, failedStores: 0 });
  const [eligibleError, setEligibleError] = useState('');
  const [eligibleMarketplace, setEligibleMarketplace] = useState('EBAY_US');
  const [stores, setStores] = useState([]);
  const [selectedSellerId, setSelectedSellerId] = useState(sellerIdFromUrl);

  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendTarget, setSendTarget] = useState(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerQuantity, setOfferQuantity] = useState('1');
  const [offerMessage, setOfferMessage] = useState('');
  const [allowCounter, setAllowCounter] = useState(true);
  const [sendingOffer, setSendingOffer] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    setSelectedSellerId(sellerIdFromUrl);
  }, [sellerIdFromUrl]);

  useEffect(() => {
    const loadStores = async () => {
      try {
        const { data } = await api.get('/sellers/all');
        setStores(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load stores:', error);
        setStores([]);
      }
    };
    loadStores();
  }, []);

  const loadEligible = useCallback(async () => {
    setLoading(true);
    setEligibleError('');
    try {
      if (selectedSellerId) {
        const { data } = await api.get('/ebay/eligible-offers', {
          params: { sellerId: selectedSellerId },
        });
        const items = (Array.isArray(data?.items) ? data.items : []).map((item) => ({
          ...item,
          sellerId: selectedSellerId,
          listingId: item.listingId || item.itemId,
        }));
        setEligibleItems(items);
        setEligibleSummary({ stores: 1, totalItems: Number(data?.total) || items.length, failedStores: 0 });
        setEligibleMarketplace('EBAY_US');
      } else {
        const { data } = await api.get('/ebay/negotiation/eligible-items', {
          params: { limit: 200, offset: 0 },
        });
        setEligibleItems(Array.isArray(data?.items) ? data.items : []);
        setEligibleSummary({
          stores: Number(data?.summary?.stores || 0),
          totalItems: Number(data?.summary?.totalItems || 0),
          failedStores: Number(data?.summary?.failedStores || 0),
        });
        setEligibleMarketplace(String(data?.request?.marketplace || data?.filters?.marketplaceId || 'EBAY_US'));
      }
    } catch (error) {
      console.error('Failed to fetch eligible offers:', error);
      setEligibleItems([]);
      setEligibleSummary({ stores: 0, totalItems: 0, failedStores: 0 });
      setEligibleError(
        error?.response?.data?.error
        || error?.response?.data?.details
        || 'Failed to fetch eligible listings'
      );
    } finally {
      setLoading(false);
    }
  }, [selectedSellerId]);

  useEffect(() => {
    loadEligible();
  }, [loadEligible]);

  const handleStoreChange = (nextSellerId) => {
    setSelectedSellerId(nextSellerId);
    const next = new URLSearchParams(searchParams);
    if (nextSellerId) next.set('sellerId', nextSellerId);
    else next.delete('sellerId');
    setSearchParams(next, { replace: true });
  };

  const openSendDialog = (item) => {
    setSendTarget(item);
    setOfferPrice(suggestOfferPrice(item));
    setOfferQuantity('1');
    setOfferMessage('');
    setAllowCounter(true);
    setSendDialogOpen(true);
  };

  const closeSendDialog = () => {
    if (sendingOffer) return;
    setSendDialogOpen(false);
    setSendTarget(null);
  };

  const handleSendOffer = async () => {
    if (!sendTarget?.listingId || !sendTarget?.sellerId) return;
    const price = parseFloat(offerPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setSnackbar({ open: true, message: 'Enter a valid offer price', severity: 'warning' });
      return;
    }

    setSendingOffer(true);
    try {
      const { data } = await api.post('/ebay/eligible-offers/send', {
        sellerId: sendTarget.sellerId,
        listingId: sendTarget.listingId,
        price,
        currency: sendTarget.currency || sendTarget.listingCurrency || sendTarget.minimumOfferCurrency || 'USD',
        quantity: parseInt(offerQuantity, 10) || 1,
        message: offerMessage || undefined,
        allowCounter,
      });
      setSnackbar({
        open: true,
        message: data?.message || 'Offer sent to interested buyers',
        severity: 'success',
      });
      setSendDialogOpen(false);
      setSendTarget(null);
      await loadEligible();
    } catch (error) {
      const msg =
        error?.response?.data?.error
        || error?.response?.data?.details
        || 'Failed to send offer';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setSendingOffer(false);
    }
  };

  const formatPrice = (value, currency) => {
    if (typeof value !== 'number') return '-';
    if (!currency) return value.toFixed(2);
    return `${currency} ${value.toFixed(2)}`;
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${date}\nat ${time}`;
  };

  const formatTimeLeft = (value) => {
    if (!value || typeof value !== 'string') return '-';
    const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
    if (!match) return value;
    const days = Number(match[1] || 0);
    const hours = Number(match[2] || 0);
    const minutes = Number(match[3] || 0);
    const seconds = Number(match[4] || 0);
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (seconds) parts.push(`${seconds}s`);
    return parts.length === 0 ? '0s' : parts.join(' ');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <Button
          component={RouterLink}
          to="/admin/store-listings"
          startIcon={<ArrowBackIcon />}
          variant="text"
          sx={{ textTransform: 'none' }}
        >
          Store Listings
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Send Offer Eligible
        </Typography>
      </Box>

      <Paper sx={{ p: 2, borderRadius: 2, mb: 2, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Store</InputLabel>
          <Select
            label="Store"
            value={selectedSellerId}
            onChange={(e) => handleStoreChange(e.target.value)}
          >
            <MenuItem value="">All Stores</MenuItem>
            {stores.map((store) => (
              <MenuItem key={store._id} value={store._id}>
                {store?.user?.username || store?.username || store._id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadEligible} disabled={loading}>
          Refresh
        </Button>
      </Paper>

      <Typography variant="body2" sx={{ mb: 1.5 }}>
        Stores: {eligibleSummary.stores} | Eligible listings: {eligibleSummary.totalItems} | Failed stores:{' '}
        {eligibleSummary.failedStores} | Marketplace: {eligibleMarketplace}
      </Typography>

      {eligibleError ? <Alert severity="error" sx={{ mb: 1.5 }}>{eligibleError}</Alert> : null}

      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Store</TableCell>
                  <TableCell>Listing ID</TableCell>
                  <TableCell>Marketplace</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Interested</TableCell>
                  <TableCell>Start date</TableCell>
                  <TableCell>Time left</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {eligibleItems.map((item, idx) => (
                  <TableRow key={`${item.sellerId || 'store'}-${item.listingId || idx}`} hover>
                    <TableCell>{item.storeName || item.sellerUsername || '-'}</TableCell>
                    <TableCell>{item.listingId || '-'}</TableCell>
                    <TableCell>{item.marketplaceId || eligibleMarketplace || '-'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', maxWidth: 360 }}>
                        <Box
                          component="img"
                          src={item.imageUrl || 'https://via.placeholder.com/48?text=No+Img'}
                          alt={item.title || 'listing'}
                          sx={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 1, border: '1px solid #eee', flexShrink: 0 }}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.25 }}>
                          {item.title || '-'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {typeof item.price === 'number'
                        ? formatPrice(item.price, item.currency)
                        : (item.listingPrice != null ? `${item.listingCurrency || item.currency || ''} ${item.listingPrice}`.trim() : '-')}
                    </TableCell>
                    <TableCell>
                      {item.interestedBuyers != null ? Number(item.interestedBuyers) : '—'}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'pre-line' }}>{formatDateTime(item.startTime)}</TableCell>
                    <TableCell sx={{ color: '#d32f2f', fontWeight: 600 }}>
                      {item.timeLeft ? formatTimeLeft(item.timeLeft) : '-'}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={!item.listingId || !item.sellerId}
                        onClick={() => openSendDialog(item)}
                        sx={{ textTransform: 'none', mr: 0.5 }}
                      >
                        Send offer
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        component="a"
                        href={item.listingId ? `https://www.ebay.com/itm/${item.listingId}` : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        disabled={!item.listingId}
                        sx={{ textTransform: 'none' }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!eligibleItems.length && (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      No eligible listings found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={sendDialogOpen} onClose={closeSendDialog} fullWidth maxWidth="sm">
        <DialogTitle>Send offer to interested buyers</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, fontWeight: 600 }}>
            {sendTarget?.title || sendTarget?.listingId || 'Listing'}
          </Typography>
          <TextField
            label="Offer price"
            type="number"
            fullWidth
            size="small"
            value={offerPrice}
            onChange={(e) => setOfferPrice(e.target.value)}
            sx={{ mb: 2 }}
            inputProps={{ min: 0, step: '0.01' }}
          />
          <TextField
            label="Quantity"
            type="number"
            fullWidth
            size="small"
            value={offerQuantity}
            onChange={(e) => setOfferQuantity(e.target.value)}
            sx={{ mb: 2 }}
            inputProps={{ min: 1, step: 1 }}
          />
          <TextField
            label="Message (optional)"
            fullWidth
            size="small"
            multiline
            minRows={2}
            value={offerMessage}
            onChange={(e) => setOfferMessage(e.target.value)}
            sx={{ mb: 1 }}
          />
          <FormControlLabel
            control={<Switch checked={allowCounter} onChange={(e) => setAllowCounter(e.target.checked)} />}
            label="Allow buyer counter-offer"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSendDialog} disabled={sendingOffer}>Cancel</Button>
          <Button variant="contained" onClick={handleSendOffer} disabled={sendingOffer}>
            {sendingOffer ? 'Sending…' : 'Send offer'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={8000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
