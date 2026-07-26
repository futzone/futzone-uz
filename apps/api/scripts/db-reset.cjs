const { spawnSync } = require('node:child_process');

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to reset the database when NODE_ENV=production.');
  process.exit(1);
}

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(command, ['exec', 'prisma', 'migrate', 'reset', '--force'], {
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Unable to run Prisma database reset: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
