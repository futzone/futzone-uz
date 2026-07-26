module.exports = import('@futzone/config/eslint/nest').then(({ default: nest }) => [
  { ignores: ['src/generated/**'] },
  ...nest,
]);
