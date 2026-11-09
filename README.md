# OS Service

Microsserviço NestJS responsável por clientes, veículos, ordens de serviço, histórico de status e coordenação local da Saga. O serviço possui schema e migrations PostgreSQL próprios; não consulta tabelas do monólito nem bancos de Billing ou Execução.

## Requisitos locais

- Node.js e npm
- Docker Desktop com o daemon Linux ativo para executar o PostgreSQL local

O CI usa Node.js 22 e PostgreSQL 16.

Configure o ambiente e inicialize o banco:

```powershell
Copy-Item .env.example .env
docker compose up -d postgres
npm ci
npm run db:generate
npm run db:migrate
npm run test:integration
npm run start:dev
```

Edite `JWT_SECRET` e `INTERNAL_API_TOKEN` no `.env` com valores locais aleatórios de pelo menos 32 caracteres. Não reutilize os valores de exemplo fora de um ambiente descartável. O serviço falha explicitamente ao iniciar se `DATABASE_URL`, `JWT_SECRET` ou `INTERNAL_API_TOKEN` estiverem ausentes ou inválidos.

O PostgreSQL local usa a porta `5433` para não conflitar com serviços já instalados. `docker compose down` para o container; os dados locais permanecem no volume `os_service_postgres`.

## API inicial

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/health/live` | Público | Liveness probe |
| `GET` | `/health/ready` | Público | Verifica conectividade com PostgreSQL |
| `POST` | `/api/v1/clientes` | Staff `ADMIN` ou `ATENDENTE` | Cadastra cliente |
| `POST` | `/api/v1/clientes/{clienteId}/veiculos` | Staff `ADMIN` ou `ATENDENTE` | Cadastra veículo do cliente |
| `POST` | `/api/v1/ordens-servico` | JWT de cliente ou staff | Abre OS; para cliente, o vínculo vem do JWT |
| `GET` | `/api/v1/ordens-servico/{id}` | JWT de proprietário ou staff | Consulta detalhes e histórico |
| `GET` | `/api/v1/ordens-servico/{id}/status` | JWT de proprietário ou staff | Consulta somente o status |
| `PATCH` | `/api/v1/ordens-servico/{id}/diagnostico` | Staff `ADMIN` ou `MECANICO` | Registra diagnóstico e solicita orçamento |
| `POST` | `/internal/v1/clientes/lookup` | `x-internal-service-token` | Consulta CPF para a Lambda de autenticação |

Tokens JWT devem usar HS256 e um dos emissores `oficina-auth-lambda` (`sub` igual ao ID do cliente) ou `oficina-staff` (`sub` igual ao ID do staff e `papel` em `ADMIN`, `ATENDENTE` ou `MECANICO`). Não há segredo JWT de fallback.

O lookup interno recebe `{ "cpf": "..." }`. Responde `404` para cliente inexistente, `403` para cliente inativo e `{ "clienteId": "..." }` para cliente ativo. O CPF é normalizado e validado, e não deve ser incluído em logs ou traces. A rota não deve ser exposta no API Gateway público. O token compartilhado é um mecanismo provisório até alinhamento com Auth sobre identidade serviço-a-serviço e política de rede.

## Persistência e consistência

A abertura da OS, o histórico inicial, a instância `STARTED` da Saga e o evento `os.order-created` são gravados na mesma transação PostgreSQL. O diagnóstico atualiza a OS e a Saga e grava `billing.quote-requested` na Outbox na mesma transação. As transições de status de negócio e os estados técnicos da Saga são modelos separados.

A Outbox já possui envelope versionado, identificadores de correlação, tentativas e campos de agendamento. O dispatcher SNS/SQS, Inbox dos eventos recebidos, retries/DLQ e as transições acionadas por Billing/Execução ainda dependem do contrato e da infraestrutura compartilhados com os demais responsáveis; os eventos pendentes não são publicados automaticamente nesta etapa.

## CI

O workflow `.github/workflows/ci.yml` roda em push para `main`, pull requests direcionados à `main` e execução manual. Ele valida o schema Prisma, lint, build, cobertura mínima, testes e2e, integração com PostgreSQL 16 e dependências de produção.

O workflow executa somente CI: não faz deploy nem impede push ou merge por si só. Exigir CI aprovada antes de integrar depende da configuração de proteção da branch no GitHub.

## Validação

```powershell
npm run build
npm run test:cov -- --runInBand
npm run test:e2e -- --runInBand
npm run test:integration
npm run lint
npm audit --omit=dev
```

O teste e2e usa repositórios e banco simulados. `test:integration` usa PostgreSQL real, restringe a conexão a um host local e limpa os registros que cria. A validação de migration aplicada requer o PostgreSQL local ativo. `npm run db:deploy` aplica as migrations já versionadas em um ambiente de implantação.
