# Checklist de contratos entre serviços — proposta

Este documento é uma base para revisão do grupo, não um padrão aprovado. Cada serviço deve publicar o contrato que realmente implementa e os donos dos serviços produtores e consumidores devem aprovar os contratos de integração antes de conectar filas ou deploys.

## Contratos HTTP

- Documentar as APIs públicas e internas em OpenAPI.
- Versionar rotas que representem contratos externos.
- Identificar autenticação, autorização, erros e responsabilidade por cada endpoint.
- Manter rotas internas fora da exposição pública do API Gateway.
- Não compartilhar acesso direto ao banco de dados de outro serviço.

O contrato HTTP atual do OS Service está em [`docs/api/openapi.yaml`](../api/openapi.yaml).

## Para cada evento

Antes de implementar um produtor ou consumidor, registrar e obter aceite dos responsáveis para:

- nome e versão do evento, serviço produtor e serviços consumidores;
- schema do payload, campos obrigatórios e compatibilidade entre versões;
- identificador do evento, agregado, correlação e propagação de trace;
- chave e janela de idempotência, ordenação e comportamento em duplicidade;
- confirmação de processamento, retry, backoff, DLQ e política de replay;
- autenticação/autorização, classificação de dados e campos proibidos em logs;
- transições de estado da Saga e ação compensatória para cada falha relevante.

## Envelope atualmente prototipado no OS Service

O código da Outbox contém `eventId`, `eventType`, `eventVersion`, `occurredAt`, `aggregateId`, `correlationId` e `payload`. Os eventos `os.order-created` e `billing.quote-requested` são protótipos locais e **não devem ser tratados como contratos finais** até que Billing, Execução e Auth confirmem ownership, payloads, transporte e semântica.

Não incluir CPF, JWT, tokens, segredos ou dados de pagamento em eventos, logs ou traces.
