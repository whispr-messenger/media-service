import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks() {
    // Note: Prisma v5+ doesn't support beforeExit event
    // This method is kept for compatibility but doesn't do anything
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'test') {
      const tablenames = (await this.$queryRawUnsafe(
        "SELECT tablename FROM pg_tables WHERE schemaname='public'",
      )) as Array<{ tablename: string }>;

      const tables = tablenames
        .map(({ tablename }) => tablename)
        .filter((name) => name !== '_prisma_migrations')
        .map((name) => `"public"."${name}"`)
        .join(', ');

      try {
        await this.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
      } catch (error) {
        console.log({ error });
      }
    }
  }
}
