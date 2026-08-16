// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

describe('Player App', () => {
  it('starts a game and completes one turn by selecting an option', async () => {
    render(<App />);
    expect(await screen.findByTestId('status-bar')).toHaveTextContent('Day 1');
    expect(screen.getByTestId('narrative-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '下一回合' }));
    expect(await screen.findByTestId('option-list')).toBeInTheDocument();
    const buttons = await screen.findAllByRole('button', { name: /帮忙|看书|推荐|了解/ });
    expect(buttons.length).toBe(4);

    fireEvent.click(buttons[0]!);
    await waitFor(() => {
      expect(screen.getByTestId('status-bar')).toHaveTextContent('Turn 1');
    });
  });
});
