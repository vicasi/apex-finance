# ApexFinance - Dashboard Financeiro com PostgreSQL e Docker

Dashboard financeiro full stack baseado no projeto original, agora com **PostgreSQL persistente** e execução via **Docker Compose**.

## Stack

- Node.js + Express
- PostgreSQL 16
- Docker / Docker Compose
- HTML, CSS e JavaScript
- Chart.js
- Yahoo Finance para cotações

## Persistência

A carteira deixou de ser armazenada em memória. Os registros ficam na tabela `portfolio` do PostgreSQL e o banco utiliza o volume Docker `postgres_data`.

Portanto, reiniciar ou recriar os containers não apaga os dados:

```bash
docker compose down
docker compose up -d --build
```

> Para apagar os dados deliberadamente, use `docker compose down -v`.

## Como executar

1. Tenha Docker Desktop instalado e aberto.
2. Opcionalmente copie `.env.example` para `.env` e altere a senha.
3. Na pasta raiz do projeto execute:

```bash
docker compose up -d --build
```

4. Abra:

http://localhost:3000

Verifique o estado da API em:

http://localhost:3000/api/health

## Comandos úteis

```bash
# Ver logs
 docker compose logs -f app

# Ver containers
 docker compose ps

# Parar sem apagar dados
 docker compose down

# Subir novamente
 docker compose up -d

# Parar e apagar banco/volume (ATENÇÃO: apaga os dados)
 docker compose down -v
```

## API

- `GET /api/portfolio` - lista a carteira
- `POST /api/portfolio` - cria posição
- `PUT /api/portfolio/:id` - atualiza posição
- `DELETE /api/portfolio/:id` - remove posição
- `GET /api/finance/:ticker` - consulta histórico no Yahoo Finance
- `GET /api/health` - verifica aplicação e PostgreSQL

Na primeira inicialização, se a tabela estiver vazia, três posições de exemplo do projeto original são inseridas automaticamente.
