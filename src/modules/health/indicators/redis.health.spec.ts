import { Test, TestingModule } from "@nestjs/testing";
import { RedisHealthIndicator } from "./redis.health";
import { RedisService } from "../../cache/redis.service";
import { HealthCheckError } from "@nestjs/terminus";

describe("RedisHealthIndicator", () => {
  let indicator: RedisHealthIndicator;
  let redisService: RedisService;

  const mockRedisService = {
    healthCheck: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    indicator = module.get<RedisHealthIndicator>(RedisHealthIndicator);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(indicator).toBeDefined();
  });

  describe("isHealthy", () => {
    it("should return healthy status when Redis responds with PONG", async () => {
      mockRedisService.healthCheck.mockResolvedValue(true);

      const result = await indicator.isHealthy("redis");

      expect(result).toEqual({
        redis: {
          status: "up",
          message: "Redis is responding",
        },
      });
      expect(mockRedisService.healthCheck).toHaveBeenCalled();
    });

    it("should throw HealthCheckError when Redis does not respond with PONG", async () => {
      mockRedisService.healthCheck.mockResolvedValue(false);

      await expect(indicator.isHealthy("redis")).rejects.toThrow(
        HealthCheckError,
      );
      expect(mockRedisService.healthCheck).toHaveBeenCalled();
    });

    it("should throw HealthCheckError when Redis connection fails", async () => {
      mockRedisService.healthCheck.mockRejectedValue(
        new Error("Connection failed"),
      );

      await expect(indicator.isHealthy("redis")).rejects.toThrow(
        HealthCheckError,
      );
      expect(mockRedisService.healthCheck).toHaveBeenCalled();
    });
  });
});
