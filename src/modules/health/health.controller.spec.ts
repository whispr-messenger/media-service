import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { HealthCheckService, PrismaHealthIndicator } from "@nestjs/terminus";
import { PrismaService } from "../database/prisma.service";
import { RedisHealthIndicator } from "./indicators/redis.health";
import { StorageHealthIndicator } from "./indicators/storage.health";

describe("HealthController", () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;
  let prismaHealth: PrismaHealthIndicator;
  let redisHealth: RedisHealthIndicator;
  let storageHealth: StorageHealthIndicator;

  const mockHealthCheckService = {
    check: jest.fn(),
  };

  const mockPrismaHealth = {
    pingCheck: jest.fn(),
  };

  const mockRedisHealth = {
    isHealthy: jest.fn(),
  };

  const mockStorageHealth = {
    isHealthy: jest.fn(),
  };

  const mockPrismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: mockHealthCheckService,
        },
        {
          provide: PrismaHealthIndicator,
          useValue: mockPrismaHealth,
        },
        {
          provide: RedisHealthIndicator,
          useValue: mockRedisHealth,
        },
        {
          provide: StorageHealthIndicator,
          useValue: mockStorageHealth,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
    prismaHealth = module.get<PrismaHealthIndicator>(PrismaHealthIndicator);
    redisHealth = module.get<RedisHealthIndicator>(RedisHealthIndicator);
    storageHealth = module.get<StorageHealthIndicator>(StorageHealthIndicator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("check", () => {
    it("should check overall health including database, redis, and storage", async () => {
      const expectedResult = {
        status: "ok",
        info: {
          database: { status: "up" },
          redis: { status: "up" },
          storage: { status: "up" },
        },
        error: {},
        details: {
          database: { status: "up" },
          redis: { status: "up" },
          storage: { status: "up" },
        },
      };

      mockHealthCheckService.check.mockResolvedValue(expectedResult);

      const result = await controller.check();

      expect(healthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      ]);
      expect(result).toEqual(expectedResult);
    });
  });

  describe("checkLiveness", () => {
    it("should check if the service is alive", async () => {
      const expectedResult = {
        status: "ok",
        info: { service: { status: "up" } },
        error: {},
        details: { service: { status: "up" } },
      };

      mockHealthCheckService.check.mockResolvedValue(expectedResult);

      const result = await controller.checkLiveness();

      expect(healthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
      ]);
      expect(result).toEqual(expectedResult);
    });
  });

  describe("checkReadiness", () => {
    it("should check if the service is ready to accept traffic", async () => {
      const expectedResult = {
        status: "ok",
        info: {
          database: { status: "up" },
          redis: { status: "up" },
          storage: { status: "up" },
        },
        error: {},
        details: {
          database: { status: "up" },
          redis: { status: "up" },
          storage: { status: "up" },
        },
      };

      mockHealthCheckService.check.mockResolvedValue(expectedResult);

      const result = await controller.checkReadiness();

      expect(healthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      ]);
      expect(result).toEqual(expectedResult);
    });

    it("should fail readiness when dependencies are unhealthy", async () => {
      const expectedResult = {
        status: "error",
        info: {},
        error: { database: { status: "down" } },
        details: {
          database: { status: "down" },
          redis: { status: "up" },
          storage: { status: "up" },
        },
      };

      mockHealthCheckService.check.mockResolvedValue(expectedResult);

      const result = await controller.checkReadiness();

      expect(result).toEqual(expectedResult);
    });
  });
});
