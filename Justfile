# Justfile for media-service development environment

# Default recipe (show available recipes)
default:
    @just --list

# Start development environment
dev-up:
    @echo "🚀 Starting development environment..."
    docker compose -f docker/docker-compose.dev.yml up -d
    @echo "✅ Development environment is running!"
    @echo "📝 API: http://localhost:3000"
    @echo "📚 Swagger: http://localhost:3000/api/docs"
    @echo "🐘 PostgreSQL: localhost:5433"
    @echo "🔴 Redis: localhost:6380"

# Stop development environment
dev-down:
    @echo "🛑 Stopping development environment..."
    docker compose -f docker/docker-compose.dev.yml down
    @echo "✅ Development environment stopped"

# Restart development environment
dev-restart:
    @echo "🔄 Restarting development environment..."
    docker compose -f docker/docker-compose.dev.yml restart
    @echo "✅ Development environment restarted"

# Build development containers
dev-build:
    @echo "🔨 Building development containers..."
    docker compose -f docker/docker-compose.dev.yml build
    @echo "✅ Containers built successfully"

# Rebuild and start development environment
dev-rebuild: dev-down dev-build dev-up

# Show logs from all services
dev-logs:
    docker compose -f docker/docker-compose.dev.yml logs -f

# Show logs from media-service only
dev-logs-app:
    docker compose -f docker/docker-compose.dev.yml logs -f media-service-dev

# Show logs from postgres only
dev-logs-db:
    docker compose -f docker/docker-compose.dev.yml logs -f postgres-dev

# Show logs from redis only
dev-logs-redis:
    docker compose -f docker/docker-compose.dev.yml logs -f redis-dev

# Execute command in media-service container
dev-exec cmd:
    docker compose -f docker/docker-compose.dev.yml exec media-service-dev {{cmd}}

# Open shell in media-service container
dev-shell:
    docker compose -f docker/docker-compose.dev.yml exec media-service-dev sh

# Run npm command in media-service container
dev-npm cmd:
    docker compose -f docker/docker-compose.dev.yml exec media-service-dev npm {{cmd}}

# Run database migrations
dev-migrate:
    @echo "🔄 Running database migrations..."
    docker compose -f docker/docker-compose.dev.yml exec media-service-dev npm run migration:run
    @echo "✅ Migrations completed"

# Generate database migration
dev-migrate-generate name:
    @echo "📝 Generating migration: {{name}}"
    docker compose -f docker/docker-compose.dev.yml exec media-service-dev npm run migration:generate -- src/migrations/{{name}}

# Revert last database migration
dev-migrate-revert:
    @echo "⏪ Reverting last migration..."
    docker compose -f docker/docker-compose.dev.yml exec media-service-dev npm run migration:revert
    @echo "✅ Migration reverted"

# Run tests in container
dev-test:
    @echo "🧪 Running tests..."
    docker compose -f docker/docker-compose.dev.yml exec media-service-dev npm test

# Run tests with coverage
dev-test-cov:
    @echo "🧪 Running tests with coverage..."
    docker compose -f docker/docker-compose.dev.yml exec media-service-dev npm run test:cov

# Run linter
dev-lint:
    @echo "🔍 Running linter..."
    docker compose -f docker/docker-compose.dev.yml exec media-service-dev npm run lint

# Format code
dev-format:
    @echo "💅 Formatting code..."
    docker compose -f docker/docker-compose.dev.yml exec media-service-dev npm run format

# Show development environment status
dev-status:
    @echo "📊 Development environment status:"
    docker compose -f docker/docker-compose.dev.yml ps

# Clean development environment (removes volumes)
dev-clean:
    @echo "🧹 Cleaning development environment..."
    docker compose -f docker/docker-compose.dev.yml down -v
    @echo "✅ Environment cleaned (volumes removed)"

# Reset development environment (clean, build, and start)
dev-reset: dev-clean dev-build dev-up

# Access PostgreSQL CLI
dev-db-cli:
    docker compose -f docker/docker-compose.dev.yml exec postgres-dev psql -U whisper_user -d whisper_media_dev

# Access Redis CLI
dev-redis-cli:
    docker compose -f docker/docker-compose.dev.yml exec redis-dev redis-cli -a redis_password

# Install dependencies in container
dev-install:
    @echo "📦 Installing dependencies..."
    docker compose -f docker/docker-compose.dev.yml exec media-service-dev npm ci
    @echo "✅ Dependencies installed"

# Show environment variables
dev-env:
    docker compose -f docker/docker-compose.dev.yml exec media-service-dev env | sort

# Start production environment
up:
    @echo "🚀 Starting production environment..."
    docker compose -f docker/docker-compose.yml up -d
    @echo "✅ Production environment is running!"

# Stop production environment
down:
    @echo "🛑 Stopping production environment..."
    docker compose -f docker/docker-compose.yml down
    @echo "✅ Production environment stopped"

# Build production containers
build:
    @echo "🔨 Building production containers..."
    docker compose -f docker/docker-compose.yml build
    @echo "✅ Production containers built successfully"

# Show production logs
logs:
    docker compose -f docker/docker-compose.yml logs -f

# Clean production environment
clean:
    @echo "🧹 Cleaning production environment..."
    docker compose -f docker/docker-compose.yml down -v
    @echo "✅ Production environment cleaned"

# Restart production environment
restart:
    @echo "🔄 Restarting production environment..."
    docker compose -f docker/docker-compose.yml restart
    @echo "✅ Production environment restarted"

# Rebuild production environment
rebuild: down build up
