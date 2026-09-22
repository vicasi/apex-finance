# Backend ApexFinance

API Express conectada ao PostgreSQL através do pacote `pg`.

A tabela `portfolio` é criada automaticamente na inicialização. O código usa queries parametrizadas e mantém os dados no PostgreSQL.

Em Docker, o host do banco é `db`, definido no `docker-compose.yml`.
