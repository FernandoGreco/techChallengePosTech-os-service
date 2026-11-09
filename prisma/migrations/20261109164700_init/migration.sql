-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CPF', 'CNPJ');

-- CreateEnum
CREATE TYPE "StatusOS" AS ENUM ('RECEBIDA', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'EM_EXECUCAO', 'FINALIZADA', 'ENTREGUE');

-- CreateEnum
CREATE TYPE "SagaStatus" AS ENUM ('STARTED', 'WAITING_FOR_QUOTE', 'WAITING_FOR_APPROVAL', 'RESERVING_STOCK', 'WAITING_FOR_PAYMENT', 'WAITING_FOR_EXECUTION', 'COMPLETED', 'COMPENSATING', 'FAILED');

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "tipo_documento" "TipoDocumento" NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veiculos" (
    "id" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "veiculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordens_servico" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "veiculo_id" TEXT NOT NULL,
    "status" "StatusOS" NOT NULL DEFAULT 'RECEBIDA',
    "diagnostico" TEXT,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_inicio_diagnostico" TIMESTAMP(3),
    "data_inicio_execucao" TIMESTAMP(3),
    "data_finalizacao" TIMESTAMP(3),
    "data_entrega" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordens_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_status_os" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT NOT NULL,
    "status_anterior" "StatusOS",
    "status_novo" "StatusOS" NOT NULL,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_status_os_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saga_instances" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT NOT NULL,
    "status" "SagaStatus" NOT NULL DEFAULT 'STARTED',
    "version" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saga_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_version" INTEGER NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "causation_id" TEXT,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_events" (
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_documento_key" ON "clientes"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "veiculos_placa_key" ON "veiculos"("placa");

-- CreateIndex
CREATE INDEX "veiculos_cliente_id_idx" ON "veiculos"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "ordens_servico_numero_key" ON "ordens_servico"("numero");

-- CreateIndex
CREATE INDEX "ordens_servico_cliente_id_created_at_idx" ON "ordens_servico"("cliente_id", "created_at");

-- CreateIndex
CREATE INDEX "historico_status_os_ordem_servico_id_created_at_idx" ON "historico_status_os"("ordem_servico_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "saga_instances_ordem_servico_id_key" ON "saga_instances"("ordem_servico_id");

-- CreateIndex
CREATE INDEX "saga_instances_status_updated_at_idx" ON "saga_instances"("status", "updated_at");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_next_attempt_at_idx" ON "outbox_events"("published_at", "next_attempt_at");

-- CreateIndex
CREATE INDEX "inbox_events_aggregate_id_processed_at_idx" ON "inbox_events"("aggregate_id", "processed_at");

-- AddForeignKey
ALTER TABLE "veiculos" ADD CONSTRAINT "veiculos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "veiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_status_os" ADD CONSTRAINT "historico_status_os_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saga_instances" ADD CONSTRAINT "saga_instances_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
