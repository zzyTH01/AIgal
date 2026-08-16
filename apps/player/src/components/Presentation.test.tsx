// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AudioPanel } from './AudioPanel.js';
import { Background } from './Background.js';
import { CgGallery } from './CgGallery.js';
import { CharacterPortrait } from './CharacterPortrait.js';
import { Typewriter } from './Typewriter.js';
import { StrategyHint } from './StrategyHint.js';

describe('Presentation components', () => {
  it('renders portrait and background placeholders', () => {
    render(<CharacterPortrait name="Mio" emotion="calm" />);
    expect(screen.getByTestId('character-portrait')).toHaveTextContent('Mio · calm');

    render(<Background locationName="图书馆" />);
    expect(screen.getAllByTestId('background').at(-1)).toHaveAttribute(
      'aria-label',
      '背景：图书馆',
    );
  });

  it('renders CG gallery from ending archive', () => {
    render(<CgGallery endings={['ending_normal_day5']} />);
    expect(screen.getByTestId('cg-gallery')).toHaveTextContent('ending_normal_day5');
  });

  it('types text over time', () => {
    vi.useFakeTimers();
    render(<Typewriter text="你好" speed={10} />);
    expect(screen.getByTestId('typewriter')).toHaveTextContent('');
    act(() => vi.advanceTimersByTime(10));
    expect(screen.getByTestId('typewriter')).toHaveTextContent('你');
    act(() => vi.advanceTimersByTime(10));
    expect(screen.getByTestId('typewriter')).toHaveTextContent('你好');
    vi.useRealTimers();
  });

  it('renders strategy hint for independent characters', () => {
    render(<StrategyHint independence={90} empathy={40} />);
    expect(screen.getByTestId('strategy-hint')).toHaveTextContent('独立性很强');
  });

  it('supports image asset sources for portrait/background', () => {
    render(<CharacterPortrait name="Mio" src="assets/mio.png" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'assets/mio.png');
    render(<Background locationName="图书馆" src="assets/bg.png" />);
    expect(screen.getAllByTestId('background').at(-1)).toHaveAttribute(
      'aria-label',
      '背景：图书馆',
    );
  });

  it('renders audio placeholders', () => {
    render(<AudioPanel />);
    expect(screen.getByText('TTS（后续接入）')).toBeDisabled();
  });
});
