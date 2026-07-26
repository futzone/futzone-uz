import base from './base.js';

export default [
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': ['error', { name: 'event', message: 'Use an explicit event parameter.' }],
    },
  },
];
