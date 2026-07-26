# Local infrastructure

The development stack provides PostgreSQL/PostGIS, Redis, MinIO, Mailpit, and a dependency-free mock SMS service.

Copy the example settings before starting:

```sh
cp .env.example .env
pnpm run docker:up
docker compose -f infrastructure/docker-compose.yml ps
```

Stop the containers while retaining their data:

```sh
pnpm run docker:down
```

## Ports

| Service | Host port | Container port | Purpose |
| --- | ---: | ---: | --- |
| PostgreSQL/PostGIS | 5432 | 5432 | Application and test databases |
| Redis | 6380 | 6379 | Cache and queues |
| MinIO | 9000 | 9000 | S3-compatible API |
| MinIO | 9001 | 9001 | Web console |
| Mailpit | 1025 | 1025 | SMTP |
| Mailpit | 8025 | 8025 | Web UI |
| Mock SMS | 4010 | 4010 | HTTP API |

## Port conflicts

Every host port is overridable in `.env` through its corresponding port variable. Redis defaults to host port 6380, while remaining on port 6379 inside the container, to avoid colliding with Redis instances commonly bound to the default host port.

Open the MinIO console at <http://localhost:9001> and sign in with `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` from `.env`. On first start, `minio-init` creates `futzone-avatars` and `futzone-stadiums`; avatar downloads are public.

## Reading OTP codes

Follow the mock service logs to see each phone number and OTP prominently:

```sh
docker compose -f infrastructure/docker-compose.yml logs -f mock-sms
```

E2E tests can retrieve the newest messages first from `GET http://localhost:4010/messages`, or retrieve the latest message for a URL-encoded phone number from `GET http://localhost:4010/messages/:phone`. Clear stored messages with `DELETE http://localhost:4010/messages`.

## Resetting local data

Reset the application database schema, deploy migrations, and load the idempotent seed with:

```sh
pnpm run db:migrate
pnpm run db:seed
pnpm run db:reset
```

`db:reset` refuses to run when `NODE_ENV=production`. Phase 0 stores typed City and Stadium fixtures under `apps/api/prisma/fixtures`; the seed command begins upserting them when their schema models are introduced in Phases 1 and 2.

To permanently remove the stack's PostgreSQL, Redis, MinIO, and Mailpit volumes, use `pnpm run docker:reset`. Recreate the services afterward with `pnpm run docker:up`.
