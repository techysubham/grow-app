import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Box,
    Typography,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    IconButton,
    useMediaQuery,
    useTheme,
    CircularProgress,
    Stack,
    FormControl,
    InputLabel,
    OutlinedInput,
    Select,
    MenuItem,
    Checkbox,
    ListItemText,
    FormHelperText,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../../lib/api';
import useFetchTable from '../../hooks/useFetchTable';
import useFormDialog from '../../hooks/useFormDialog';

const INITIAL_FORM = { name: '', accountNumber: '', ifscCode: '', sellers: '' };

function sellersFieldToTokens(s) {
    if (s == null || !String(s).trim()) return [];
    return String(s)
        .split(/[,;]+/)
        .map((t) => t.trim())
        .filter(Boolean);
}

/** Store rows for Select: stable id, display label, canonical store name saved in `sellers`. */
function buildStoreOptions(storesList) {
    const rows = (storesList || [])
        .map((st) => {
            const name = (st.name || '').trim();
            if (!name) return null;
            const plat = st.platform?.name?.trim();
            return {
                id: String(st._id),
                label: plat ? `${name} (${plat})` : name,
                name,
            };
        })
        .filter(Boolean);
    rows.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    return rows;
}

const BankAccountsPage = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [stores, setStores] = useState([]);

    const { rows: accounts, loading, refetch } = useFetchTable('/bank-accounts');

    const loadStores = useCallback(() => {
        let cancelled = false;
        api
            .get('/stores')
            .then(({ data }) => {
                if (cancelled || !Array.isArray(data)) return;
                setStores(data);
            })
            .catch(() => {
                if (!cancelled) setStores([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        return loadStores();
    }, [loadStores]);

    const storeOptions = useMemo(() => buildStoreOptions(stores), [stores]);

    const storeNameSet = useMemo(() => new Set(storeOptions.map((o) => o.name)), [storeOptions]);

    const dialog = useFormDialog(INITIAL_FORM, {
        onSave: (formData, editingId) =>
            editingId
                ? api.put(`/bank-accounts/${editingId}`, formData)
                : api.post('/bank-accounts', formData),
        onAfterSave: refetch,
    });

    useEffect(() => {
        if (!dialog.open) return;
        const cancel = loadStores();
        return cancel;
    }, [dialog.open, loadStores]);

    const selectedStoreIds = useMemo(() => {
        const tokens = sellersFieldToTokens(dialog.formData.sellers);
        const ids = [];
        for (const t of tokens) {
            if (!storeNameSet.has(t)) continue;
            const opt = storeOptions.find((o) => o.name === t);
            if (opt && !ids.includes(opt.id)) ids.push(opt.id);
        }
        return ids;
    }, [dialog.formData.sellers, storeNameSet, storeOptions]);

    const otherSellerTokens = useMemo(() => {
        const tokens = sellersFieldToTokens(dialog.formData.sellers);
        return tokens.filter((t) => !storeNameSet.has(t));
    }, [dialog.formData.sellers, storeNameSet]);

    const setSellersFromParts = (storeIds, otherTokens) => {
        const namesFromIds = storeIds
            .map((id) => storeOptions.find((o) => o.id === id)?.name)
            .filter(Boolean);
        const merged = [...namesFromIds, ...otherTokens.map((t) => t.trim()).filter(Boolean)];
        dialog.setFormData({ ...dialog.formData, sellers: merged.join(', ') });
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this bank account?')) return;
        try {
            await api.delete(`/bank-accounts/${id}`);
            refetch();
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
            <CircularProgress />
        </Box>
    );

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Box 
                display="flex" 
                flexDirection={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between" 
                alignItems={{ xs: 'stretch', sm: 'center' }}
                gap={{ xs: 1, sm: 1 }}
                mb={3}
            >
                <Typography variant="h5">Bank Accounts</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                    <Button
                        variant="outlined"
                        startIcon={<AccountBalanceIcon />}
                        component={RouterLink}
                        to="/admin/payoneer"
                        fullWidth={isMobile}
                    >
                        Payoneer Sheet
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={dialog.openCreate}
                        fullWidth={isMobile}
                    >
                        Add Bank Account
                    </Button>
                </Stack>
            </Box>

            <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell>Bank Name</TableCell>
                            <TableCell>Account Number</TableCell>
                            <TableCell>IFSC Code</TableCell>
                            <TableCell>Sellers</TableCell>
                            <TableCell>Payoneer</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {accounts.map((acc) => (
                            <TableRow key={acc._id}>
                                <TableCell>{acc.name}</TableCell>
                                <TableCell sx={{ fontSize: { xs: '0.85rem', sm: '1rem' } }}>{acc.accountNumber}</TableCell>
                                <TableCell sx={{ fontSize: { xs: '0.85rem', sm: '1rem' } }}>{acc.ifscCode}</TableCell>
                                <TableCell sx={{ fontSize: { xs: '0.85rem', sm: '1rem' }, maxWidth: 280 }}>{acc.sellers || '—'}</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                    <Typography variant="body2" component="span" sx={{ mr: 1 }}>
                                        {(acc.payoneerRecordCount ?? 0) === 0
                                            ? '0 records'
                                            : `${acc.payoneerRecordCount} record${acc.payoneerRecordCount === 1 ? '' : 's'}`}
                                    </Typography>
                                    <Button
                                        size="small"
                                        variant="text"
                                        component={RouterLink}
                                        to={`/admin/payoneer?bankAccount=${acc._id}`}
                                    >
                                        View
                                    </Button>
                                </TableCell>
                                <TableCell align="right">
                                    <IconButton onClick={() => dialog.openEdit(acc, (a) => ({ name: a.name, accountNumber: a.accountNumber || '', ifscCode: a.ifscCode || '', sellers: a.sellers || '' }))} color="primary" size="small"><EditIcon /></IconButton>
                                    <IconButton onClick={() => handleDelete(acc._id)} color="error" size="small"><DeleteIcon /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                        {accounts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} align="center">No accounts found.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={dialog.open} onClose={dialog.handleClose} fullWidth maxWidth="sm">
                <DialogTitle>{dialog.editingId ? 'Edit Bank Account' : 'New Bank Account'}</DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <Box display="flex" flexDirection="column" gap={2}>
                        <TextField
                            label="Bank Name"
                            fullWidth
                            value={dialog.formData.name}
                            onChange={(e) => dialog.setFormData({ ...dialog.formData, name: e.target.value })}
                        />
                        <TextField
                            label="Account Number (Optional)"
                            fullWidth
                            value={dialog.formData.accountNumber}
                            onChange={(e) => dialog.setFormData({ ...dialog.formData, accountNumber: e.target.value })}
                        />
                        <TextField
                            label="IFSC Code (Optional)"
                            fullWidth
                            value={dialog.formData.ifscCode}
                            onChange={(e) => dialog.setFormData({ ...dialog.formData, ifscCode: e.target.value })}
                        />
                        <FormControl fullWidth>
                            <InputLabel id="bank-account-stores-label">Stores (dropdown)</InputLabel>
                            <Select
                                labelId="bank-account-stores-label"
                                multiple
                                disabled={storeOptions.length === 0}
                                value={selectedStoreIds}
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    const nextIds = typeof raw === 'string' ? raw.split(',') : raw;
                                    setSellersFromParts(nextIds, otherSellerTokens);
                                }}
                                input={<OutlinedInput label="Stores (dropdown)" />}
                                renderValue={(selected) =>
                                    selected.length
                                        ? selected
                                              .map((id) => storeOptions.find((o) => o.id === id)?.name)
                                              .filter(Boolean)
                                              .join(', ')
                                        : storeOptions.length === 0
                                          ? 'No stores'
                                          : 'Select stores…'
                                }
                                MenuProps={{ PaperProps: { style: { maxHeight: 360 } } }}
                            >
                                {storeOptions.map((o) => (
                                    <MenuItem key={o.id} value={o.id}>
                                        <Checkbox checked={selectedStoreIds.indexOf(o.id) > -1} size="small" />
                                        <ListItemText primary={o.label} />
                                    </MenuItem>
                                ))}
                            </Select>
                            <FormHelperText>
                                {storeOptions.length === 0
                                    ? 'No stores in the database yet — add them under Manage Stores, or use Other sellers below.'
                                    : 'Choose one or more stores; store names are saved together with Other sellers into the Sellers field.'}
                            </FormHelperText>
                        </FormControl>
                        <TextField
                            label="Other sellers (Optional)"
                            fullWidth
                            placeholder="Seller usernames, comma-separated"
                            value={otherSellerTokens.join(', ')}
                            onChange={(e) => {
                                const nextOthers = sellersFieldToTokens(e.target.value);
                                setSellersFromParts(selectedStoreIds, nextOthers);
                            }}
                            helperText="Use for usernames that are not in the store list above."
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={dialog.handleClose}>Cancel</Button>
                    <Button onClick={dialog.handleSave} variant="contained" disabled={dialog.saving}>
                        {dialog.saving ? 'Saving…' : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default BankAccountsPage;
