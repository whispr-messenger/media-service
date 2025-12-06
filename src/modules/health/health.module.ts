import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./health.controller";
import { DatabaseModule } from "../database/database.module";
import { CacheModule } from "../cache/cache.module";
import { StorageModule } from "../storage/storage.module";
import { RedisHealthIndicator } from "./indicators/redis.health";
import { StorageHealthIndicator } from "./indicators/storage.health";

@Module({
  imports: [TerminusModule, DatabaseModule, CacheModule, StorageModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, StorageHealthIndicator],
})
export class HealthModule {}
