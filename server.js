const path = require('path');
const express = require('express');
const { ensureDb } = require('./lib/store');
const { getState, handleAction } = require('./lib/actions');

ensureDb();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));

app.get('/api/os', (req, res) => {
  try {
    res.json(getState(req.query));
  } catch (err) {
    res.status(500).json({ error: err.message || 'Ошибка чтения данных' });
  }
});

app.post('/api/os', (req, res) => {
  try {
    const result = handleAction(req.body || {});
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Ошибка сохранения' });
  }
});

app.get('/favicon.svg', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.svg'));
});

app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`GetSite OS listening on http://0.0.0.0:${PORT}`);
});
