import { defineWorkspace } from 'vitest/config';

// 每个包/应用作为一个独立 Vitest 项目运行。
// apps/player 需要 jsdom + React Testing Library setup，因此显式配置。
export default defineWorkspace([
  'packages/*',
  'packages/adapters/*',
  {
    test: {
      name: '@ag/designer',
      root: 'apps/designer',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: '@ag/devtools',
      root: 'apps/devtools',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: '@ag/player',
      root: 'apps/player',
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  },
]);
