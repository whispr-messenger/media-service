import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { HealthCheckService, HealthCheck, HealthCheckResult, PrismaHealthIndicator } from "@nestjs/terminus";
import { Public } from "../auth/public.decorator";
import { PrismaService } from "../database/prisma.service";
import { RedisHealthIndicator } from "./indicators/redis.health";
import { StorageHealthIndicator } from "./indicators/storage.health";

@ApiTags("health")
@Controller("health")
@Public()
export class HealthController {
    constructor(
        private readonly health: HealthCheckService,
        private readonly prismaHealth: PrismaHealthIndicator,
        private readonly redisHealth: RedisHealthIndicator,
        private readonly storageHealth: StorageHealthIndicator,
        private readonly prisma: PrismaService,
    ) { }

    @Get()
    @HealthCheck()
    @ApiOperation({ summary: "Check overall service health" })
    @ApiResponse({ status: 200, description: "Service is healthy" })
    @ApiResponse({ status: 503, description: "Service is unhealthy" })
    check(): Promise<HealthCheckResult> {
        return this.health.check([
            () => this.prismaHealth.pingCheck("database", this.prisma),
            () => this.redisHealth.isHealthy("redis"),
            () => this.storageHealth.isHealthy("storage"),
        ]);
    }

    @Get("live")
    @HealthCheck()
    @ApiOperation({ summary: "Liveness probe - checks if the service is running" })
    @ApiResponse({ status: 200, description: "Service is alive" })
    @ApiResponse({ status: 503, description: "Service is not alive" })
    checkLiveness(): Promise<HealthCheckResult> {
        return this.health.check([
            // Liveness only checks if the app is responsive
            // No external dependencies checked here
            () =>
                Promise.resolve({
                    service: {
                        status: "up",
                    },
                }),
        ]);
    }

    @Get("ready")
    @HealthCheck()
    @ApiOperation({ summary: "Readiness probe - checks if the service is ready to accept traffic" })
    @ApiResponse({ status: 200, description: "Service is ready" })
    @ApiResponse({ status: 503, description: "Service is not ready" })
    checkReadiness(): Promise<HealthCheckResult> {
        return this.health.check([
            () => this.prismaHealth.pingCheck("database", this.prisma),
            () => this.redisHealth.isHealthy("redis"),
            () => this.storageHealth.isHealthy("storage"),
        ]);
    }
}
