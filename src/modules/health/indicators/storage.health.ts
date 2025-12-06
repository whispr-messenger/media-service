import { Injectable, Logger } from "@nestjs/common";
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";
import { StorageService } from "../../storage/storage.service";

@Injectable()
export class StorageHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(StorageHealthIndicator.name);

  constructor(private readonly storageService: StorageService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const isHealthy = await this.checkStorageConnection();

      const healthResult = this.getStatus(key, isHealthy, {
        message: isHealthy
          ? "Storage (MinIO/GCS) is accessible"
          : "Storage (MinIO/GCS) is not accessible",
      });

      if (isHealthy) {
        return healthResult;
      }

      throw new HealthCheckError("Storage check failed", healthResult);
    } catch (error) {
      const healthResult = this.getStatus(key, false, {
        message:
          error instanceof Error
            ? error.message
            : "Storage (MinIO/GCS) connection failed",
      });
      throw new HealthCheckError("Storage check failed", healthResult);
    }
  }

  private async checkStorageConnection(): Promise<boolean> {
    try {
      // Check if bucket is accessible by attempting to check its existence
      // This is a lightweight operation that verifies MinIO/GCS connectivity
      const isAccessible = await this.storageService.checkBucketAccess();
      return isAccessible;
    } catch (error) {
      this.logger.error(
        `Storage health check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return false;
    }
  }
}
