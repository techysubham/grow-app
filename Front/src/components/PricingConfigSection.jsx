import { useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  Grid,
  TextField,
  Switch,
  FormControlLabel,
  Collapse,
  Alert,
  Divider
} from '@mui/material';
import ProfitTiersSection from './ProfitTiersSection.jsx';

export default function PricingConfigSection({ pricingConfig, onChange }) {
  const handleFieldChange = (field, value) => {
    onChange({
      ...pricingConfig,
      [field]: value === '' ? null : parseFloat(value)
    });
  };

  const handleEnabledChange = (enabled) => {
    onChange({
      ...pricingConfig,
      enabled
    });
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          💰 Start Price Calculator
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={pricingConfig?.enabled || false}
              onChange={(e) => handleEnabledChange(e.target.checked)}
            />
          }
          label="Enable Auto Calculation"
        />
      </Box>

      <Collapse in={pricingConfig?.enabled}>
        <Box sx={{ mt: 2 }}>
          {/* Currency Conversion Rates */}
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Currency Conversion Rates
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Spent Rate (USD → INR)"
                type="number"
                value={pricingConfig?.spentRate || ''}
                onChange={(e) => handleFieldChange('spentRate', e.target.value)}
                helperText="Exchange rate for expenses (e.g., 83.5)"
                fullWidth
                inputProps={{ step: 0.01, min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Payout Rate (USD → INR)"
                type="number"
                value={pricingConfig?.payoutRate || ''}
                onChange={(e) => handleFieldChange('payoutRate', e.target.value)}
                helperText="Exchange rate for payouts (e.g., 82.0)"
                fullWidth
                inputProps={{ step: 0.01, min: 0 }}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Profit Configuration - Fixed or Tiered */}
          <ProfitTiersSection
            pricingConfig={pricingConfig}
            onChange={onChange}
          />

          <Divider sx={{ my: 3 }} />

          {/* Fixed Costs */}
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Fixed Costs
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <TextField
                label="eBay fixed (USD)"
                type="number"
                value={pricingConfig?.ebayFixedUsd ?? 0.4}
                onChange={(e) => handleFieldChange('ebayFixedUsd', e.target.value)}
                helperText="Added to % of A (default 0.40)"
                fullWidth
                inputProps={{ step: 0.01, min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="T.Cont (USD)"
                type="number"
                value={pricingConfig?.transactionContUsd ?? 0.24}
                onChange={(e) => handleFieldChange('transactionContUsd', e.target.value)}
                helperText="Per order (default 0.24)"
                fullWidth
                inputProps={{ step: 0.01, min: 0 }}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Percentage-based Fees */}
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Percentage-based Fees
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} md={3}>
              <TextField
                label="Sale tax on sold (%)"
                type="number"
                value={pricingConfig?.saleTax ?? 10}
                onChange={(e) => handleFieldChange('saleTax', e.target.value)}
                helperText="Fee base A = Sold × (1 + this/100). Default 10 → A = 1.1×Sold"
                fullWidth
                inputProps={{ step: 0.1, min: 0, max: 100 }}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField
                label="eBay fee on A (%)"
                type="number"
                value={pricingConfig?.ebayFee ?? 13.95}
                onChange={(e) => handleFieldChange('ebayFee', e.target.value)}
                helperText="eBay USD = A × (this/100) + eBay fixed USD above"
                fullWidth
                inputProps={{ step: 0.1, min: 0, max: 100 }}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField
                label="Ads Fee (%)"
                type="number"
                value={pricingConfig?.adsFee ?? 15}
                onChange={(e) => handleFieldChange('adsFee', e.target.value)}
                fullWidth
                inputProps={{ step: 0.1, min: 0, max: 100 }}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField
                label="TDS Fee (%)"
                type="number"
                value={pricingConfig?.tdsFee ?? 1}
                onChange={(e) => handleFieldChange('tdsFee', e.target.value)}
                fullWidth
                inputProps={{ step: 0.1, min: 0, max: 100 }}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Cost Components */}
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Cost Components
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Shipping Cost (USD)"
                type="number"
                value={pricingConfig?.shippingCost ?? 0}
                onChange={(e) => handleFieldChange('shippingCost', e.target.value)}
                helperText="Fixed shipping cost per item"
                fullWidth
                inputProps={{ step: 0.01, min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Tax Rate on Cost (%)"
                type="number"
                value={pricingConfig?.taxRate ?? 10}
                onChange={(e) => handleFieldChange('taxRate', e.target.value)}
                helperText="Default: 10%"
                fullWidth
                inputProps={{ step: 0.1, min: 0, max: 100 }}
              />
            </Grid>
          </Grid>

          {/* Formula Preview */}
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2" component="div">
              <strong>Formula (settlement):</strong>
              <Box component="div" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', mt: 1 }}>
                Net USD = Sold − eBay(A) − ADS(A) − TDS(A) − T.Cont, with{' '}
                <strong>A = Sold × (1 + sale tax on sold / 100)</strong> and{' '}
                <strong>eBay = A × (eBay % / 100) + eBay fixed USD</strong>. Use the fields above for your % values.
                <br />
                Target INR profit = Payout×Net − (Buying USD×Spent). Start price solves for Sold so that equals{' '}
                {pricingConfig?.profitTiers?.enabled ? 'tier profit' : 'desired profit'}.
              </Box>
              
              {pricingConfig?.profitTiers?.enabled && pricingConfig?.profitTiers?.tiers?.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" fontWeight="bold">Profit Tiers:</Typography>
                  <Box component="ul" sx={{ mt: 0.5, pl: 2, mb: 0 }}>
                    {pricingConfig.profitTiers.tiers.map((tier, i) => (
                      <li key={i}>
                        <Typography variant="caption">
                          ${tier.minCost} – {tier.maxCost !== null ? `$${tier.maxCost}` : `${tier.minCost}+`}: {tier.profit} INR
                        </Typography>
                      </li>
                    ))}
                  </Box>
                </Box>
              )}
              
              <Box sx={{ mt: 1 }}>
                <strong>Where:</strong> Buying Price = Amazon Cost + Shipping + Tax (Amazon Cost × Tax Rate)
              </Box>
            </Typography>
          </Alert>
        </Box>
      </Collapse>
    </Paper>
  );
}
