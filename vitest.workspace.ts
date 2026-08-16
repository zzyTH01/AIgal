import { defineWorkspace } from 'vitest/config';

// 每个包/应用作为一个独立 Vitest 项目运行
export default defineWorkspace(['packages/*', 'packages/adapters/*', 'apps/*']);
