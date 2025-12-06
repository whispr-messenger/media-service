import { Injectable } from "@nestjs/common";
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";
import { RedisService } from "../../cache/redis.service";

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const isHealthy = await this.redisService.healthCheck();

      const healthResult = this.getStatus(key, isHealthy, {
        message: isHealthy ? "Redis is responding" : "Redis is not responding",
      });

      if (isHealthy) {
        return healthResult;
      }

      throw new HealthCheckError("Redis check failed", healthResult);
    } catch (error) {
      const healthResult = this.getStatus(key, false, {
        message: error instanceof Error ? error.message : "Redis connection failed",
      });
      throw new HealthCheckError("Redis check failed", healthResult);
    }
  }
}
