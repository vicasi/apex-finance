const API_URL = 'http://localhost:3000/api';
let chartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  loadPortfolio();
  fetchYahooData();
});

// -------------------------------------------------------------
// [GET] Buscar histórico via Backend (Yahoo Finance)
// -------------------------------------------------------------
async function fetchYahooData() {
  const ticker = document.getElementById('searchTicker').value.trim().toUpperCase() || 'API';

  try {
    const response = await fetch(`${API_URL}/finance/${ticker}`);
    if (!response.ok) throw new Error('Ticker não encontrado');

    const data = await response.json();
    const result = data.chart.result[0];

    const meta = result.meta;
    const timestamps = result.timestamp;
    const prices = result.indicators.quote[0].close;

    const currentPrice = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose;
    const change = ((currentPrice - prevClose) / prevClose) * 100;

    document.getElementById('dispTicker').innerText = meta.symbol;
    document.getElementById('dispPrice').innerText = `$${currentPrice.toFixed(2)}`;

    const changeEl = document.getElementById('dispChange');
    changeEl.innerText = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    changeEl.className = `metric-value ${change >= 0 ? 'positive' : 'negative'}`;

    const labels = timestamps.map(ts => new Date(ts * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    updateChart(labels, prices, meta.symbol);

  } catch (error) {
    alert(`Erro ao buscar dados do ticker "${ticker}". Verifique se o código está correto.`);
  }
}

// -------------------------------------------------------------
// [GET] Carregar Carteira do Backend
// -------------------------------------------------------------
async function loadPortfolio() {
  try {
    const response = await fetch(`${API_URL}/portfolio`);
    const portfolio = await response.json();
    renderPortfolio(portfolio);
  } catch (error) {
    console.error('Erro ao carregar carteira:', error);
  }
}

function renderPortfolio(portfolio) {
  const tbody = document.getElementById('portfolioTable');
  const countBadge = document.getElementById('portfolioCount');
  tbody.innerHTML = '';

  if (countBadge) {
    countBadge.innerText = `${portfolio.length} Ativo${portfolio.length !== 1 ? 's' : ''}`;
  }

  portfolio.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item.ticker}</strong></td>
      <td>${item.qty}</td>
      <td>$${item.price.toFixed(2)}</td>
      <td class="text-right">
        <button class="btn btn-action-warning" onclick="startEdit(${item.id}, '${item.ticker}', ${item.qty}, ${item.price})">Editar</button>
        <button class="btn btn-action-danger" onclick="deleteItem(${item.id})">Excluir</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// -------------------------------------------------------------
// [POST] & [PUT] Adicionar / Atualizar Ativo
// -------------------------------------------------------------
async function handleFormSubmit(event) {
  event.preventDefault();

  const id = document.getElementById('editId').value;
  const ticker = document.getElementById('inputTicker').value;
  const qty = document.getElementById('inputQty').value;
  const price = document.getElementById('inputPrice').value;

  const body = JSON.stringify({ ticker, qty, price });
  const headers = { 'Content-Type': 'application/json' };

  if (id === "-1") {
    // [POST] Criar
    await fetch(`${API_URL}/portfolio`, { method: 'POST', headers, body });
  } else {
    // [PUT] Atualizar
    await fetch(`${API_URL}/portfolio/${id}`, { method: 'PUT', headers, body });
  }

  resetForm();
  loadPortfolio();
}

function startEdit(id, ticker, qty, price) {
  const formTitle = document.getElementById('formTitle');
  formTitle.innerHTML = `<span class="badge badge-put">PUT</span> Editar: ${ticker}`;

  document.getElementById('editId').value = id;
  document.getElementById('inputTicker').value = ticker;
  document.getElementById('inputQty').value = qty;
  document.getElementById('inputPrice').value = price;

  document.getElementById('btnSubmit').innerText = 'Atualizar Posição';
  document.getElementById('btnCancelEdit').style.display = 'block';
}

// -------------------------------------------------------------
// [DELETE] Remover Ativo
// -------------------------------------------------------------
async function deleteItem(id) {
  if (confirm('Deseja remover este ativo da sua carteira?')) {
    await fetch(`${API_URL}/portfolio/${id}`, { method: 'DELETE' });
    loadPortfolio();
  }
}

// -------------------------------------------------------------
// Auxiliares e Gráficos
// -------------------------------------------------------------
function resetForm() {
  document.getElementById('portfolioForm').reset();
  document.getElementById('editId').value = '-1';
  document.getElementById('formTitle').innerHTML = '<span class="badge badge-post">POST</span> Adicionar Posição';
  document.getElementById('btnSubmit').innerText = 'Salvar na Carteira';
  document.getElementById('btnCancelEdit').style.display = 'none';
}

function updateChart(labels, dataPrices, tickerSymbol) {
  const ctx = document.getElementById('financeChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  // Criar gradiente elegante sob a linha do gráfico
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
  gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: `Fechamento (${tickerSymbol})`,
        data: dataPrices,
        borderColor: '#38bdf8',
        borderWidth: 2.5,
        backgroundColor: gradient,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#38bdf8',
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans', size: 11 } },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans', size: 11 } },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  });
}