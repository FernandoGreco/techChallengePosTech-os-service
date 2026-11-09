import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import assert from 'node:assert/strict';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const jwtSecret = 'os-service-integration-jwt-secret-over-32-characters';
const internalToken =
  'os-service-integration-internal-token-over-32-characters';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJson(text: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) {
    throw new Error('Expected JSON object in service response');
  }
  return parsed;
}

function token(sub: string, issuer: string, papel?: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ sub, iss: issuer, papel, iat: now, exp: now + 3600 }),
  ).toString('base64url');
  const signature = createHmac('sha256', jwtSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

function cpfAleatorioValido(): string {
  const base = [...randomBytes(9)].map((byte) => String(byte % 10)).join('');
  if (/^(\d)\1{8}$/.test(base)) {
    return cpfAleatorioValido();
  }

  const digito = (parcial: string, pesoInicial: number): number => {
    const soma = [...parcial].reduce(
      (total, numero, indice) =>
        total + Number(numero) * (pesoInicial - indice),
      0,
    );
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const primeiro = digito(base, 10);
  const segundo = digito(`${base}${primeiro}`, 11);
  return `${base}${primeiro}${segundo}`;
}

function placaAleatoria(): string {
  const bytes = randomBytes(4);
  const alfanumerico = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return `TST${bytes[0] % 10}${alfanumerico[bytes[1] % 36]}${String(
    bytes[2] % 10,
  )}${String(bytes[3] % 10)}`;
}

describe('OS Service com PostgreSQL real', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService | undefined;
  let clienteId = '';
  let veiculoId = '';
  let ordemServicoId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma && ordemServicoId) {
      await prisma.outboxEvent.deleteMany({
        where: { aggregateId: ordemServicoId },
      });
      await prisma.ordemServico.deleteMany({
        where: { id: ordemServicoId },
      });
    }
    if (prisma && veiculoId) {
      await prisma.veiculo.deleteMany({ where: { id: veiculoId } });
    }
    if (prisma && clienteId) {
      await prisma.cliente.deleteMany({ where: { id: clienteId } });
    }
    if (app) {
      await app.close();
    }
  });

  it('persiste o fluxo OS, ownership, lookup, Saga e Outbox', async () => {
    const database = prisma;
    if (!database) {
      throw new Error('PrismaService não foi inicializado');
    }

    const staffToken = token('integration-staff', 'oficina-staff', 'ADMIN');
    const clienteToken = (id: string) => token(id, 'oficina-auth-lambda');
    const cpf = cpfAleatorioValido();

    const clienteResponse = await request(app.getHttpServer())
      .post('/api/v1/clientes')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        nome: 'Cliente de integração',
        documento: cpf,
        tipoDocumento: 'CPF',
        telefone: '11999999999',
        email: `${randomUUID()}@example.test`,
      })
      .expect(201);
    clienteId = String(readJson(clienteResponse.text).id);
    assert.ok(clienteId && clienteId !== 'undefined');

    const veiculoResponse = await request(app.getHttpServer())
      .post(`/api/v1/clientes/${clienteId}/veiculos`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        placa: placaAleatoria(),
        marca: 'Teste',
        modelo: 'Integração',
        ano: 2022,
      })
      .expect(201);
    veiculoId = String(readJson(veiculoResponse.text).id);
    assert.ok(veiculoId && veiculoId !== 'undefined');

    const ordemResponse = await request(app.getHttpServer())
      .post('/api/v1/ordens-servico')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ clienteId, veiculoId })
      .expect(201);
    ordemServicoId = String(readJson(ordemResponse.text).id);
    assert.ok(ordemServicoId && ordemServicoId !== 'undefined');
    assert.equal(readJson(ordemResponse.text).status, 'RECEBIDA');

    await request(app.getHttpServer())
      .get(`/api/v1/ordens-servico/${ordemServicoId}`)
      .set('Authorization', `Bearer ${clienteToken(clienteId)}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/ordens-servico/${ordemServicoId}`)
      .set('Authorization', `Bearer ${clienteToken(randomUUID())}`)
      .expect(404);
    await request(app.getHttpServer())
      .post('/internal/v1/clientes/lookup')
      .set('x-internal-service-token', internalToken)
      .send({ cpf })
      .expect(200)
      .expect(({ text }) => {
        assert.equal(readJson(text).clienteId, clienteId);
      });

    const diagnosticoResponse = await request(app.getHttpServer())
      .patch(`/api/v1/ordens-servico/${ordemServicoId}/diagnostico`)
      .set(
        'Authorization',
        `Bearer ${token('integration-mechanic', 'oficina-staff', 'MECANICO')}`,
      )
      .send({ diagnostico: 'Falha de integração detectada' })
      .expect(200);
    assert.equal(
      readJson(diagnosticoResponse.text).status,
      'AGUARDANDO_APROVACAO',
    );

    const persistedOrder = await database.ordemServico.findUnique({
      where: { id: ordemServicoId },
      include: { saga: true, historico: true },
    });
    assert.ok(persistedOrder);
    assert.equal(persistedOrder.saga?.status, 'WAITING_FOR_QUOTE');
    assert.equal(persistedOrder.historico.length, 3);

    const events = await database.outboxEvent.findMany({
      where: { aggregateId: ordemServicoId },
      select: { eventType: true },
    });
    assert.deepEqual(
      new Set(events.map((event) => event.eventType)),
      new Set(['os.order-created', 'billing.quote-requested']),
    );
  });
});
