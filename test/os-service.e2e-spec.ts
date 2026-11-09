import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import type { Server } from 'node:http';
import { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { CLIENTES_REPOSITORY } from '../src/clientes/application/clientes.repository';
import { ORDENS_SERVICO_REPOSITORY } from '../src/ordens-servico/application/ordens-servico.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const jwtSecret = 'test-jwt-secret-with-more-than-32-characters';
const internalToken = 'test-internal-token-with-more-than-32-characters';

function criarTokenCliente(clienteId: string): string {
  const cabecalho = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const agora = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: clienteId,
      iss: 'oficina-auth-lambda',
      iat: agora,
      exp: agora + 3600,
    }),
  ).toString('base64url');
  const assinatura = createHmac('sha256', jwtSecret)
    .update(`${cabecalho}.${payload}`)
    .digest('base64url');

  return `${cabecalho}.${payload}.${assinatura}`;
}

function criarTokenStaff(staffId: string, papel: string): string {
  const cabecalho = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const agora = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: staffId,
      iss: 'oficina-staff',
      papel,
      iat: agora,
      exp: agora + 3600,
    }),
  ).toString('base64url');
  const assinatura = createHmac('sha256', jwtSecret)
    .update(`${cabecalho}.${payload}`)
    .digest('base64url');

  return `${cabecalho}.${payload}.${assinatura}`;
}

describe('OS Service (e2e)', () => {
  let app: INestApplication<Server>;
  const ordemCriada = {
    id: 'a0f3f6b8-8ee1-4e50-8a5b-1c4221a9c002',
    numero: 1,
    clienteId: 'cliente-1',
    veiculoId: 'veiculo-1',
    status: 'RECEBIDA',
  };
  const ordemDetalhada = {
    ...ordemCriada,
    diagnostico: null,
    dataCriacao: '2026-01-01T10:00:00.000Z',
    cliente: { id: 'cliente-1', nome: 'Ana' },
    veiculo: {
      id: 'veiculo-1',
      placa: 'ABC1D23',
      marca: 'Marca',
      modelo: 'Modelo',
      ano: 2020,
    },
    historico: [],
  };
  const prisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]),
  };
  const clientesRepository = {
    cadastrar: jest.fn(),
    cadastrarVeiculo: jest.fn(),
    buscarPorCpf: jest.fn(),
  };
  const ordensServicoRepository = {
    abrir: jest.fn(),
    buscarPorId: jest.fn(),
    registrarDiagnostico: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(CLIENTES_REPOSITORY)
      .useValue(clientesRepository)
      .overrideProvider(ORDENS_SERVICO_REPOSITORY)
      .useValue(ordensServicoRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('expõe health live sem depender do banco', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('verifica a prontidão com consulta ao banco', async () => {
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect({ status: 'ok' });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('responde indisponível quando o banco não pode ser consultado', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('database unavailable', {
        code: 'P1001',
        clientVersion: '5.22.0',
      }),
    );

    await request(app.getHttpServer()).get('/health/ready').expect(503);
  });

  it('exige credencial de serviço para lookup interno', async () => {
    await request(app.getHttpServer())
      .post('/internal/v1/clientes/lookup')
      .send({ cpf: '52998224725' })
      .expect(401);
  });

  it('rejeita CPF inválido antes de consultar cliente', async () => {
    await request(app.getHttpServer())
      .post('/internal/v1/clientes/lookup')
      .set('x-internal-service-token', internalToken)
      .send({ cpf: '111.111.111-11' })
      .expect(400);

    expect(clientesRepository.buscarPorCpf).not.toHaveBeenCalled();
  });

  it('consulta CPF por API interna autenticada', async () => {
    clientesRepository.buscarPorCpf.mockResolvedValue({
      clienteId: 'cliente-1',
      ativo: true,
    });

    await request(app.getHttpServer())
      .post('/internal/v1/clientes/lookup')
      .set('x-internal-service-token', internalToken)
      .send({ cpf: '529.982.247-25' })
      .expect(200)
      .expect({ clienteId: 'cliente-1' });
  });

  it('retorna 404 para cliente ausente e 403 para cliente inativo', async () => {
    clientesRepository.buscarPorCpf
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        clienteId: 'cliente-inativo',
        ativo: false,
      });

    await request(app.getHttpServer())
      .post('/internal/v1/clientes/lookup')
      .set('x-internal-service-token', internalToken)
      .send({ cpf: '52998224725' })
      .expect(404);
    await request(app.getHttpServer())
      .post('/internal/v1/clientes/lookup')
      .set('x-internal-service-token', internalToken)
      .send({ cpf: '52998224725' })
      .expect(403);
  });

  it('cadastra cliente com credencial de staff e normaliza os dados', async () => {
    clientesRepository.cadastrar.mockResolvedValue({
      id: 'cliente-1',
      nome: 'Ana',
      email: 'ana@example.com',
    });

    await request(app.getHttpServer())
      .post('/api/v1/clientes')
      .set('Authorization', `Bearer ${criarTokenStaff('staff-1', 'ATENDENTE')}`)
      .send({
        nome: ' Ana ',
        documento: '529.982.247-25',
        tipoDocumento: 'CPF',
        telefone: '11999999999',
        email: ' ANA@EXAMPLE.COM ',
      })
      .expect(201);

    expect(clientesRepository.cadastrar).toHaveBeenCalledWith(
      expect.objectContaining({
        documento: '52998224725',
        email: 'ana@example.com',
      }),
    );
  });

  it('cadastra veículo somente para staff com papel permitido', async () => {
    clientesRepository.cadastrarVeiculo.mockResolvedValue({
      id: 'veiculo-1',
      clienteId: 'cliente-1',
      placa: 'ABC1D23',
      marca: 'Marca',
      modelo: 'Modelo',
      ano: 2020,
    });

    await request(app.getHttpServer())
      .post('/api/v1/clientes/cliente-1/veiculos')
      .set('Authorization', `Bearer ${criarTokenStaff('staff-1', 'ADMIN')}`)
      .send({
        placa: 'abc-1d23',
        marca: ' Marca ',
        modelo: ' Modelo ',
        ano: 2020,
      })
      .expect(201);

    expect(clientesRepository.cadastrarVeiculo).toHaveBeenCalledWith(
      expect.objectContaining({ placa: 'ABC1D23', clienteId: 'cliente-1' }),
    );
  });

  it('usa o cliente autenticado ao abrir OS, ignorando clienteId do body', async () => {
    ordensServicoRepository.abrir.mockResolvedValue(ordemCriada);

    await request(app.getHttpServer())
      .post('/api/v1/ordens-servico')
      .set('Authorization', `Bearer ${criarTokenCliente('cliente-1')}`)
      .send({
        veiculoId: '6a5bd1af-1f54-4237-8fa9-7d149202ae68',
        clienteId: '9ec7fc13-63a9-4c65-99fd-5dd33ae93d8e',
      })
      .expect(201);

    expect(ordensServicoRepository.abrir).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 'cliente-1' }),
    );
  });

  it('consulta detalhes e status apenas para o proprietário ou staff', async () => {
    ordensServicoRepository.buscarPorId.mockResolvedValue(ordemDetalhada);

    await request(app.getHttpServer())
      .get('/api/v1/ordens-servico/a0f3f6b8-8ee1-4e50-8a5b-1c4221a9c002')
      .set('Authorization', `Bearer ${criarTokenCliente('cliente-1')}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/ordens-servico/a0f3f6b8-8ee1-4e50-8a5b-1c4221a9c002/status')
      .set('Authorization', `Bearer ${criarTokenCliente('cliente-1')}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({ id: ordemCriada.id, status: 'RECEBIDA' }),
        );
      });

    await request(app.getHttpServer())
      .get('/api/v1/ordens-servico/a0f3f6b8-8ee1-4e50-8a5b-1c4221a9c002')
      .set('Authorization', `Bearer ${criarTokenCliente('cliente-2')}`)
      .expect(404);
  });

  it('permite diagnóstico apenas para staff autorizado', async () => {
    ordensServicoRepository.registrarDiagnostico.mockResolvedValue(
      ordemDetalhada,
    );

    await request(app.getHttpServer())
      .patch(
        '/api/v1/ordens-servico/a0f3f6b8-8ee1-4e50-8a5b-1c4221a9c002/diagnostico',
      )
      .set('Authorization', `Bearer ${criarTokenStaff('staff-1', 'MECANICO')}`)
      .send({ diagnostico: 'Falha identificada' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(
        '/api/v1/ordens-servico/a0f3f6b8-8ee1-4e50-8a5b-1c4221a9c002/diagnostico',
      )
      .set('Authorization', `Bearer ${criarTokenStaff('staff-2', 'ATENDENTE')}`)
      .send({ diagnostico: 'Falha identificada' })
      .expect(403);
  });
});
