// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App.js';

afterEach(() => cleanup());

describe('Player App', () => {
  it('advances beats and stops at the choice point (manual mode)', async () => {
    render(<App />);
    expect(await screen.findByTestId('status-bar')).toHaveTextContent('Day 1');

    // 首个文段拍
    fireEvent.click(screen.getByRole('button', { name: '下一回合' }));
    const firstBeat = await screen.findAllByTestId('transition-line');
    expect(firstBeat.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('flow-controls')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /帮忙|看书|推荐|了解/ })).toBeNull();

    // ▼ 继续推进，直到选择点（控件消失、选项出现）
    let guard = 0;
    while (guard < 8) {
      guard += 1;
      const controls = screen.queryByTestId('flow-controls');
      if (!controls) break;
      fireEvent.click(screen.getByRole('button', { name: '继续' }));
      await waitFor(() => {
        expect(screen.getByTestId('flow-controls') ?? screen.getByTestId('option-list'));
      });
      if (screen.queryByTestId('option-list')) break;
    }
    const optionList = await screen.findByTestId('option-list');
    expect(optionList).toBeInTheDocument();
  });

  it('auto-play stops at the choice point as well', async () => {
    render(<App />);
    await screen.findByTestId('status-bar');
    fireEvent.click(screen.getByRole('button', { name: '下一回合' }));
    await screen.findAllByTestId('transition-line');

    fireEvent.click(screen.getByTestId('auto-play'));
    // 等待自动连播把流推进到选择点：选项出现且自动仍开启
    const optionList = await screen.findByTestId('option-list', undefined, { timeout: 4000 });
    expect(optionList).toBeInTheDocument();
    expect(screen.getByTestId('auto-play')).toBeChecked();
  });
});
