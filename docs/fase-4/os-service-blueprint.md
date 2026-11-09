# Fase 4 — Blueprint do OS Service

## 1. Objetivo e escopo

Este documento define a proposta inicial do microsserviço de Ordens de Serviço (OS) para a Fase 4. O serviço será responsável pelo cadastro de clientes e veículos, ciclo de vida da OS, histórico de status e coordenação da Saga que integra Billing e Execução.

O repositório `techChallengePosTech-Aplication` permanece como legado da Fase 3. O OS Service e este blueprint pertencem ao repositório dedicado `techChallengePosTech-os-service`.

## 2. Decisões de arquitetura

- Microsserviços de domínio: OS, Billing e Execução.
- Clientes e veículos pertencem ao OS Service.
- O OS Service coordena a Saga.
- Integração assíncrona por AWS SNS/SQS; REST fica reservado a consultas e comandos síncronos que precisem de resposta imediata.
- PostgreSQL é o banco do OS Service. Billing terá banco PostgreSQL isolado e Execução usará DynamoDB.
- Nenhum serviço acessa diretamente o banco de outro serviço.
- O cluster Kubernetes atual é a plataforma compartilhada; o serviço terá seus próprios manifests, configuração e pipeline.
- O estado da OS e o estado técnico da Saga são conceitos distintos. A Saga terá estados persistidos próprios, sem expor estados temporários de integração como status de negócio da OS.

## 3. Responsabilidades e propriedade dos dados

### Pertencem ao OS Service

- Cliente, incluindo documento, nome, e-mail, telefone e status ativo.
- Veículo e vínculo com cliente.
- Ordem de serviço e seus dados de abertura.
- Histórico de transições da OS.
- Estado da Saga e Outbox de eventos.
- Regras de propriedade: clientes só podem consultar as próprias OS.

### Não pertencem ao OS Service

- Orçamentos, aprovações comerciais e pagamentos: Billing.
- Integração Mercado Pago: Billing.
- Fila de trabalho, diagnóstico operacional, reparos e reservas/quantidade de estoque: Execução.
- Infraestrutura compartilhada de cluster e rede: repositórios de plataforma.

Os serviços podem manter identificadores externos e snapshots mínimos necessários ao seu domínio, mas não devem manter cópias que se tornem fontes concorrentes da mesma informação.

## 4. Interfaces propostas

### API de negócio

- `POST /api/v1/ordens-servico`: cria uma OS.
- `GET /api/v1/ordens-servico/{id}`: consulta uma OS conforme autorização.
- `GET /api/v1/ordens-servico/{id}/status`: consulta o status permitido ao cliente.
- Endpoints administrativos para registrar diagnóstico e solicitar geração de orçamento, a definir no contrato OpenAPI.

### Consulta interna de cliente

A Lambda de autenticação precisa validar se o CPF existe e se o cliente está ativo. A consulta deve ser uma API serviço-a-serviço, por exemplo `POST /internal/v1/clientes/lookup`, com autenticação própria da Lambda e transporte protegido.

Essa rota não deve ser pública nem depender do JWT do cliente, pois é chamada antes da emissão desse token. O mecanismo de autenticação entre serviços deve ser escolhido na integração com Auth/API Gateway. O CPF não deve aparecer em URLs, logs ou traces.

### Envelope de evento

Eventos SNS/SQS devem usar envelope versionado, com pelo menos:

- `eventId`
- `eventType`
- `eventVersion`
- `occurredAt`
- `aggregateId` (ID da OS)
- `correlationId`
- `causationId`, quando aplicável
- `payload`

O contexto de tracing deve ser propagado nos atributos da mensagem. Eventos devem conter apenas os dados necessários ao consumidor.

## 5. Saga orquestrada pelo OS Service

O OS Service mantém o registro da Saga no PostgreSQL e coordena as etapas. O fluxo de referência é:

1. Criar OS e registro inicial da Saga na mesma transação local.
2. Quando o diagnóstico estiver pronto, solicitar a criação do orçamento ao Billing por evento.
3. Receber a confirmação de orçamento gerado e aguardar a aprovação do cliente.
4. Após a aprovação, solicitar ao serviço de Execução a reserva dos itens necessários.
5. Se a reserva for confirmada, solicitar ao Billing a criação da cobrança/preferência no Mercado Pago.
6. Receber o evento de pagamento confirmado, publicado após validação do webhook pelo Billing.
7. Solicitar o início da execução e aguardar os eventos de início e conclusão.
8. Atualizar o estado de negócio da OS conforme os eventos válidos recebidos.

### Estados técnicos iniciais da Saga

- `STARTED`
- `WAITING_FOR_QUOTE`
- `WAITING_FOR_APPROVAL`
- `RESERVING_STOCK`
- `WAITING_FOR_PAYMENT`
- `WAITING_FOR_EXECUTION`
- `COMPLETED`
- `COMPENSATING`
- `FAILED`

Os estados finais da OS devem continuar representando o domínio; os estados acima representam o andamento da integração distribuída. A lista final e o mapeamento para o status da OS serão definidos com os donos de Billing e Execução.

### Compensações

- Falha na geração do orçamento: registrar falha da Saga e manter a OS em estado operacionalmente identificável.
- Estoque indisponível: interromper a progressão e comunicar Billing para cancelar ou invalidar o orçamento aprovado.
- Pagamento recusado ou expirado: solicitar liberação da reserva de estoque.
- Falha irrecuperável depois do pagamento: solicitar estorno ao Mercado Pago e liberação dos recursos.
- Falha no estorno: manter o estado `COMPENSATING` ou equivalente, emitir alerta e permitir reconciliação/manual de suporte.

Compensação não é rollback de banco distribuído. Cada serviço executa uma ação local, idempotente e auditável.

### Confiabilidade das mensagens

- Gravar alteração de domínio e evento na Outbox na mesma transação PostgreSQL.
- Publicar a Outbox para SNS/SQS por processo separado e repetível.
- Consumidores registram `eventId` processado em Inbox ou mecanismo equivalente.
- Processamento duplicado não pode repetir cobrança, reserva ou transição de status.
- Configurar retry limitado, DLQ e procedimento de replay/reconciliação.
- Usar ordenação por OS somente onde necessária; não depender da ordem global de mensagens.

## 6. Modelo de persistência inicial

O PostgreSQL do OS Service deverá conter, no mínimo:

- `clientes`
- `veiculos`
- `ordens_servico`
- `historico_status_os`
- `saga_instances` (ou estrutura equivalente para estado e versão da Saga)
- `outbox_events`
- `inbox_events`, se o OS consumir eventos de outros serviços

As migrations do OS Service ficam no próprio repositório e são executadas pelo pipeline do serviço. O banco lógico e as credenciais do OS devem ser exclusivos; Billing não recebe essas credenciais.

A migração inicial deve preservar IDs das entidades referenciadas pelos demais serviços. Antes do cutover, comparar quantidade de registros, relacionamentos e status entre origem e destino. Evitar dual-write; definir janela de congelamento de escrita ou estratégia explícita de corte.

## 7. Testes e critérios de aceite do OS Service

- Testes unitários para entidades, regras de transição, casos de uso, orquestração e compensações.
- Testes de integração para PostgreSQL, Outbox, Inbox e repositórios.
- Testes de contrato para APIs e eventos consumidos/publicados.
- Cobertura mínima de 80% no serviço, medida e bloqueada pelo CI.
- Teste BDD integrado do fluxo de sucesso: abertura de OS, orçamento, aprovação, pagamento e execução.
- Teste BDD de falha com compensação, por exemplo estoque indisponível ou pagamento expirado.
- Testar reentrega de evento, webhook duplicado, timeout, DLQ e retomada da Saga.
- Validar que cliente só consulta OS de sua propriedade e que chamadas internas exigem identidade serviço-a-serviço.

## 8. Observabilidade

- Logs JSON com `correlationId`, ID da OS e ID da Saga; não incluir CPF, JWT, segredo ou dados de pagamento.
- `dd-trace` inicializado antes do bootstrap da aplicação.
- Propagar contexto de tracing através de SNS/SQS.
- Métricas do serviço: OS criadas, Sagas por estado, duração da Saga, compensações, falhas de publicação/consumo, retries e mensagens em DLQ.
- Dashboards devem permitir seguir uma OS entre OS, Billing e Execução sem depender de um único log local.
- Alertas para DLQ, Saga parada por tempo excessivo, falhas de compensação e indisponibilidade do banco.

## 9. Plano de implementação da parte de OS

### Etapa A — Contratos e bootstrap

- Confirmar OpenAPI da consulta interna de cliente e eventos com Auth, Billing e Execução.
- Criar estrutura NestJS, configuração por ambiente, healthchecks, logging, testes e pipeline.
- Criar projeto de migrations e conexão exclusiva ao PostgreSQL de OS.

**Saída:** serviço inicial compilando, testado e implantável em homologação.

### Etapa B — Domínio e API de OS

- Extrair cliente, veículo, OS, histórico e regras de status do legado.
- Implementar casos de uso e repositórios sem dependência cruzada entre camadas.
- Publicar endpoints de negócio e consulta interna, com autorização e validação.

**Saída:** fluxo local de criação/consulta de OS funcionando com banco próprio.

### Etapa C — Eventos e Saga

- Implementar estado persistido da Saga, Outbox e consumidores idempotentes.
- Integrar a geração de orçamento e a aprovação com Billing.
- Integrar reserva e execução com o serviço de Execução.
- Implementar timeouts, compensações, DLQ e reconciliação.

**Saída:** fluxo integrado de sucesso e falha executável em homologação.

### Etapa D — Migração e cutover

- Preparar script de migração do banco legado para o PostgreSQL do OS.
- Ensaiar a migração e validar IDs, relacionamentos e status.
- Definir janela de corte, rollback operacional e quando desativar o deploy legado.

**Saída:** dados necessários disponíveis no OS Service e legado sem escrita concorrente.

### Etapa E — Entrega final

- Atingir gates de cobertura, Sonar e testes BDD.
- Validar deploy, probes, logs, traces, métricas e alertas.
- Atualizar README, diagramas, OpenAPI e evidências da apresentação.

**Saída:** serviço pronto para o fluxo demonstrado no vídeo e para operação em homologação/produção.

## Progresso da implementação local — 2026-11-09

Nesta branch temporária, a estrutura NestJS foi substituída por uma primeira fatia executável do OS Service:

- API de clientes, veículos e OS, consulta de status, registro de diagnóstico, lookup interno de CPF e healthchecks.
- Autenticação JWT HS256 para os emissores `oficina-auth-lambda` e `oficina-staff`; o vínculo do cliente autenticado é usado ao abrir e consultar OS.
- Schema Prisma/PostgreSQL próprio para clientes, veículos, OS, histórico, instância da Saga, Outbox e Inbox, com migration inicial gerada.
- Abertura da OS e registro inicial de histórico, Saga e evento são atômicos. O diagnóstico atualiza a OS e a Saga e grava a solicitação de orçamento na Outbox na mesma transação.
- A Saga tem uma máquina de estados de domínio testada; as transições acionadas por mensagens externas ainda não estão conectadas.
- `npm run test:cov -- --runInBand` passa o gate de 80% (95,24% statements, 82,37% branches, 97,61% functions e 94,78% lines); há também testes HTTP com dependências simuladas.

A migration foi aplicada no PostgreSQL local com Docker Desktop, e `npm run test:integration` validou o fluxo real de cadastro, abertura, ownership, diagnóstico, Saga e Outbox, removendo os dados de teste ao final. Na validação final, `npm run lint`, `npm run build`, `npm run test:cov -- --runInBand` e `npm run test:e2e -- --runInBand` passaram; a integração real também passou isoladamente e `npm run db:status` confirmou o schema atualizado. A Outbox ainda não publica em SNS/SQS e o OS não consome eventos; isso depende do contrato versionado e da infraestrutura acordados com Billing, Execução e Auth. O repositório dedicado está sendo inicializado com esta implementação; pipeline e deploy ainda não foram configurados.

## 10. Pendências que exigem alinhamento do grupo

- Mecanismo de autenticação da Lambda para a API interna do OS.
- Se bancos PostgreSQL separados logicamente no RDS atendem ao requisito de “banco próprio” ou se a rubrica exige instâncias físicas distintas.
- Contrato final de eventos, versionamento e propriedade dos campos compartilhados.
- Estados de negócio da OS durante pagamento, reserva e compensação.
- Estratégia de migração e corte dos dados do legado.
- Padrão uniforme de branch e ambiente (`homolog`/`main`) em todos os repositórios.

## 11. Referências da Fase 3 e cuidado com a branch

O repositório Auth atualmente consulta diretamente a tabela de clientes. A infraestrutura de banco da Fase 3 representa um banco monolítico, e o cluster Kubernetes é uma plataforma compartilhada. Esses componentes precisam ser adaptados sem permitir acesso cruzado aos bancos dos novos serviços.

O desenvolvimento inicial ocorreu na branch local `fase-4/os-service-blueprint` do repositório legado. Essa branch não deve ser mesclada na `main` do legado; o serviço e sua documentação seguem no repositório dedicado `techChallengePosTech-os-service`.
