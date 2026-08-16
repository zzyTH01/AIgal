// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

describe('Designer App', () => {
  it('compiles character assets and simulates one turn', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '编译项目' }));
    expect(await screen.findByTestId('project-preview')).toHaveTextContent('Card: Mio');

    fireEvent.click(screen.getByRole('button', { name: '模拟一回合' }));
    await waitFor(
      () => {
        expect(screen.getByTestId('project-preview')).toHaveTextContent('模拟完成');
      },
      { timeout: 3000 },
    );
  });
});
