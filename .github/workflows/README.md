# GitHub workflows

`ci.yml` runs lint, type checking, unit tests, and builds on pull requests and pushes to `main`. Its separate e2e job starts PostGIS and Redis service containers, creates `futzone_test`, deploys Prisma migrations, and runs the API e2e suite.

`docker.yml` builds (but does not push) commit-SHA-tagged production images for the API, web app, and admin app on pushes to `main`. Buildx reuses GitHub Actions layer caches scoped per image.

No secrets are currently required. A future registry/deploy step will need the target registry username/token (for example `REGISTRY_USERNAME` and `REGISTRY_TOKEN`) plus deployment-environment secrets such as `DATABASE_URL`, `REDIS_URL`, object-storage credentials, and application signing/provider credentials. Those runtime secrets must not be baked into images.
