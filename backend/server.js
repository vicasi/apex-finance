const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = Number(process.env.PORT || 3000);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'apexfinance',
  user: process.env.DB_USER || 'apexfinance',
  password: process.env.DB_PASSWORD || 'apexfinance',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portfolio (
      id SERIAL PRIMARY KEY,
      ticker VARCHAR(20) NOT NULL,
      qty NUMERIC(18, 6) NOT NULL CHECK (qty >= 0),
      price NUMERIC(18, 6) NOT NULL CHECK (price >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM portfolio');
  if (rows[0].count === 0) {
    await pool.query(`
      INSERT INTO portfolio (ticker, qty, price)
      VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9)
    `, ['API', 50, 12.50, 'AAPL', 10, 175.00, 'PETR4.SA', 100, 38.20]);
    console.log('Carteira inicial criada no PostgreSQL.');
  }
}

function validatePortfolioInput(body, partial = false) {
  const { ticker, qty, price } = body;
  if (!partial && (!ticker || qty === undefined || price === undefined)) {
    return 'Campos "ticker", "qty" e "price" são obrigatórios';
  }
  if (ticker !== undefined && (!String(ticker).trim() || String(ticker).length > 20)) {
    return 'Ticker inválido';
  }
  if (qty !== undefined && (!Number.isFinite(Number(qty)) || Number(qty) < 0)) {
    return 'Quantidade inválida';
  }
  if (price !== undefined && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
    return 'Preço inválido';
  }
  return null;
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

app.get('/api/finance/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1mo&interval=1d`;
  try {
    const response = await fetch(yahooUrl, { headers: { 'User-Agent': 'ApexFinance/2.0' } });
    if (!response.ok) return res.status(404).json({ error: 'Ticker não encontrado ou falha na API' });
    const data = await response.json();
    if (!data.chart?.result?.[0]) return res.status(404).json({ error: 'Ticker sem dados disponíveis' });
    res.json(data);
  } catch (err) {
    console.error('Yahoo Finance:', err.message);
    res.status(502).json({ error: 'Erro ao buscar dados do Yahoo Finance' });
  }
});

app.get('/api/portfolio', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, ticker, qty::float AS qty, price::float AS price, created_at, updated_at
      FROM portfolio ORDER BY id ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao carregar carteira' });
  }
});

app.post('/api/portfolio', async (req, res) => {
  const error = validatePortfolioInput(req.body);
  if (error) return res.status(400).json({ error });
  const ticker = String(req.body.ticker).trim().toUpperCase();
  const qty = Number(req.body.qty);
  const price = Number(req.body.price);
  try {
    const { rows } = await pool.query(`
      INSERT INTO portfolio (ticker, qty, price)
      VALUES ($1, $2, $3)
      RETURNING id, ticker, qty::float AS qty, price::float AS price, created_at, updated_at
    `, [ticker, qty, price]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar ativo' });
  }
});

app.put('/api/portfolio/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' });
  const error = validatePortfolioInput(req.body, true);
  if (error) return res.status(400).json({ error });

  try {
    const current = await pool.query('SELECT * FROM portfolio WHERE id = $1', [id]);
    if (current.rowCount === 0) return res.status(404).json({ error: 'Item não encontrado' });
    const item = current.rows[0];
    const ticker = req.body.ticker !== undefined ? String(req.body.ticker).trim().toUpperCase() : item.ticker;
    const qty = req.body.qty !== undefined ? Number(req.body.qty) : Number(item.qty);
    const price = req.body.price !== undefined ? Number(req.body.price) : Number(item.price);

    const { rows } = await pool.query(`
      UPDATE portfolio
      SET ticker = $1, qty = $2, price = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING id, ticker, qty::float AS qty, price::float AS price, created_at, updated_at
    `, [ticker, qty, price, id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar ativo' });
  }
});

app.delete('/api/portfolio/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' });
  try {
    const { rows } = await pool.query(`
      DELETE FROM portfolio WHERE id = $1
      RETURNING id, ticker, qty::float AS qty, price::float AS price
    `, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Item não encontrado' });
    res.json({ message: 'Item removido com sucesso', item: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover ativo' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

async function start() {
  try {
    await initDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`ApexFinance rodando em http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Falha ao inicializar PostgreSQL:', err.message);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

start();
