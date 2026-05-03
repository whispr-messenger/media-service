# Structure du projet

```
src/
├── config/           # Configuration (S3, Redis, DB)
├── modules/
│   ├── auth/         # Guard JWT
│   ├── cache/        # Cache Redis
│   ├── database/     # Service Prisma
│   ├── encryption/   # Chiffrement AES-256
│   ├── grpc/         # Clients gRPC
│   ├── media/        # Logique principale
│   └── storage/      # Stockage S3/MinIO
├── app.module.ts
└── main.ts
```
