# Docker Configuration

## Production Deployment

### Quick Start

```bash
# Build and start all services
docker-compose -f docker/docker-compose.yml up -d

# View logs
docker-compose -f docker/docker-compose.yml logs -f

# Stop services
docker-compose -f docker/docker-compose.yml down
```

### Using Justfile

```bash
# Production
just up          # Start services
just down        # Stop services
just logs        # View logs
just build       # Build images
just clean       # Clean everything

# Development
just dev-up      # Start dev environment
just dev-down    # Stop dev environment
just dev-logs    # View dev logs

# Utilities
just shell       # Access service shell
just db-shell    # Access PostgreSQL
just redis-shell # Access Redis
just test        # Run tests
just restart     # Restart service
just rebuild     # Rebuild and restart
```

## Development Environment

### Start Development

```bash
# Using docker-compose
docker-compose -f docker/docker-compose.dev.yml up -d

# Using Justfile
just dev-up
```

### Features

- Hot reload enabled
- Debug port exposed (9229)
- Volume mounting for live code changes
- Separate development database
- Enhanced logging

## Services

### Media Service
- **Port**: 3000
- **Health Check**: http://localhost:3000/health
- **Debug Port**: 9229 (dev only)

### PostgreSQL
- **Port**: 5432 (prod), 5433 (dev)
- **Database**: whisper_media
- **User**: whisper_user
- **Password**: whisper_password

### Redis
- **Port**: 6379 (prod), 6380 (dev)
- **Password**: redis_password

## Environment Variables

### Production (.env.docker)
```env
NODE_ENV=production
DATABASE_HOST=postgres
REDIS_HOST=redis
JWT_SECRET=your-super-secret-jwt-key
```

### Development
```env
NODE_ENV=development
DATABASE_SYNCHRONIZE=true
DATABASE_LOGGING=true
```

## Health Checks

All services include health checks:
- **Media Service**: HTTP endpoint check
- **PostgreSQL**: pg_isready command
- **Redis**: ping command

## Volumes

### Production
- `postgres_data`: PostgreSQL data persistence
- `redis_data`: Redis data persistence

### Development
- Source code mounted for hot reload
- Separate data volumes for isolation

## Networks

- **Production**: whisper-network
- **Development**: whisper-dev-network

## Security

- Non-root user execution
- Minimal Alpine images
- Password-protected Redis
- Network isolation
- Health check monitoring

## Troubleshooting

### Common Issues

1. **Port conflicts**
   ```bash
   # Check port usage
   lsof -i :3000
   ```

2. **Database connection**
   ```bash
   # Check PostgreSQL logs
   docker-compose -f docker/docker-compose.yml logs postgres
   ```

3. **Redis connection**
   ```bash
   # Test Redis connection
   docker-compose -f docker/docker-compose.yml exec redis redis-cli -a redis_password ping
   ```

### Cleanup

```bash
# Remove all containers and volumes
just clean

# Remove unused Docker resources
docker system prune -a
```

## Monitoring

### Service Status
```bash
# Check all services
docker-compose -f docker/docker-compose.yml ps

# Check specific service health
docker-compose -f docker/docker-compose.yml exec media-service wget -qO- http://localhost:3000/health
```

### Resource Usage
```bash
# Monitor resource usage
docker stats
```
