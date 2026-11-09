import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientInitializationError ||
        error instanceof Prisma.PrismaClientKnownRequestError
      ) {
        throw new ServiceUnavailableException('Banco de dados indisponível');
      }
      throw error;
    }
  }
}
