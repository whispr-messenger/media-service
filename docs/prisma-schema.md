# Prisma Schema

## Tables

```
┌──────────────┐     ┌──────────────┐
│    media     │────▶│  categories  │
│              │     │              │
│ - id         │     │ - id         │
│ - filename   │     │ - name       │
│ - mimeType   │     └──────────────┘
│ - fileSize   │
│ - userId     │
│ - encrypted  │
│ - createdAt  │
└──────────────┘
```

## Migrations

```bash
npm run prisma:generate
npm run prisma:migrate
```
