.PHONY: help install dev build test docker-dev docker-prod migrate seed

help:
	@echo "D'Lifestyle Backend - Available Commands"
	@echo "========================================"
	@echo "install       - Install dependencies"
	@echo "dev           - Start development server"
	@echo "build         - Build for production"
	@echo "test          - Run unit tests"
	@echo "test-e2e      - Run e2e tests"
	@echo "lint          - Run ESLint"
	@echo "format        - Format code with Prettier"
	@echo "docker-dev    - Start with Docker Compose (dev)"
	@echo "docker-prod   - Start with Docker Compose (prod)"
	@echo "migrate       - Run database migrations"
	@echo "seed          - Seed initial data"
	@echo ""

install:
	npm install

dev:
	npm run dev

build:
	npm run build

test:
	npm run test

test-e2e:
	npm run test:e2e

lint:
	npm run lint

format:
	npm run format

docker-dev:
	npm run docker:dev

docker-prod:
	npm run docker:prod

migrate:
	npm run db:migrate

seed:
	npm run db:seed

clean:
	rm -rf dist node_modules coverage

clone-env:
	cp .env.example .env
