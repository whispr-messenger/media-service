import { Test, TestingModule } from "@nestjs/testing";
import { StorageHealthIndicator } from "./storage.health";
import { StorageService } from "../../storage/storage.service";
import { HealthCheckError } from "@nestjs/terminus";

describe("StorageHealthIndicator", () => {
  let indicator: StorageHealthIndicator;
  let storageService: StorageService;

  const mockStorageService = {
    checkBucketAccess: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageHealthIndicator,
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    indicator = module.get<StorageHealthIndicator>(StorageHealthIndicator);
    storageService = module.get<StorageService>(StorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(indicator).toBeDefined();
  });

  describe("isHealthy", () => {
    it("should return healthy status when storage is accessible", async () => {
      mockStorageService.checkBucketAccess.mockResolvedValue(true);

      const result = await indicator.isHealthy("storage");

      expect(result).toEqual({
        storage: {
          status: "up",
          message: "Storage (MinIO/GCS) is accessible",
        },
      });
      expect(mockStorageService.checkBucketAccess).toHaveBeenCalled();
    });

    it("should throw HealthCheckError when storage is not accessible", async () => {
      mockStorageService.checkBucketAccess.mockResolvedValue(false);

      await expect(indicator.isHealthy("storage")).rejects.toThrow(
        HealthCheckError,
      );
      expect(mockStorageService.checkBucketAccess).toHaveBeenCalled();
    });

    it("should throw HealthCheckError when storage check throws an error", async () => {
      mockStorageService.checkBucketAccess.mockRejectedValue(
        new Error("Connection failed"),
      );

      await expect(indicator.isHealthy("storage")).rejects.toThrow(
        HealthCheckError,
      );
      expect(mockStorageService.checkBucketAccess).toHaveBeenCalled();
    });
  });
});
