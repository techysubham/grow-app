import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

const STORAGE_KEY = 'description-templates.gallery.v1';

export default function DescriptionTemplatesPage() {
  const [title, setTitle] = useState('');
  const [htmlInput, setHtmlInput] = useState('');
  const [templates, setTemplates] = useState([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setTemplates(parsed);
    } catch (e) {
      console.error('Failed to load description templates from localStorage', e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  }, [templates, isHydrated]);

  const addTemplate = () => {
    if (!htmlInput.trim()) return;
    const template = {
      id: `${Date.now()}`,
      title: title.trim() || `Template ${templates.length + 1}`,
      html: htmlInput,
    };
    setTemplates((prev) => [template, ...prev]);
    setTitle('');
    setHtmlInput('');
  };

  const clearAll = () => setTemplates([]);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Description Templates
      </Typography>

      <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Stack spacing={1.5}>
          <TextField
            label="Template Name (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
          />
          <TextField
            label="HTML Code"
            value={htmlInput}
            onChange={(e) => setHtmlInput(e.target.value)}
            multiline
            minRows={8}
            fullWidth
            placeholder="<div>Paste your template HTML here...</div>"
          />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={addTemplate}>
              Add Template
            </Button>
            <Button variant="outlined" color="error" onClick={clearAll}>
              Clear All
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        {templates.map((template) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={template.id}>
            <Card sx={{ borderRadius: 2 }}>
              <CardMedia sx={{ height: 190, borderBottom: '1px solid #eee' }}>
                <iframe
                  title={`preview-${template.id}`}
                  srcDoc={template.html}
                  style={{ width: '100%', height: '100%', border: 0, background: '#fff' }}
                  sandbox=""
                />
              </CardMedia>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {template.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  English
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
