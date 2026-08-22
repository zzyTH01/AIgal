import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Beat, GameState, Option } from '@ag/schemas';
import { createPlayerApi } from './api-client.js';
import { NarrativePanel, type NarrativeEntry } from './components/NarrativePanel.js';
import { FlowControls } from './components/FlowControls.js';
import { OptionList } from './components/OptionList.js';
import { RelationshipPanel } from './components/RelationshipPanel.js';
import { SavePanel } from './components/SavePanel.js';
import { StatusBar } from './components/StatusBar.js';
import { CharacterPortrait } from './components/CharacterPortrait.js';
import { Background } from './components/Background.js';
import { Typewriter } from './components/Typewriter.js';
import { CgGallery } from './components/CgGallery.js';
import { AudioPanel } from './components/AudioPanel.js';
import { StrategyHint } from './components/StrategyHint.js';

type Phase = 'idle' | 'awaiting-advance' | 'awaiting-choice';

export function App() {
  const api = useMemo(() => createPlayerApi(), []);
  const [state, setState] = useState<GameState | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [narrative, setNarrative] = useState<NarrativeEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReaction, setLastReaction] = useState<string>('');
  const [lastSaveId, setLastSaveId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [autoPlay, setAutoPlay] = useState(false);
  const stateRef = useRef<GameState | null>(null);

  const applyState = (next: GameState) => {
    stateRef.current = next;
    setState(next);
  };

  const appendBeat = (beat: Beat, fresh: GameState) => {
    const nameById = new Map(
      Object.entries(fresh.characters).map(([id, character]) => [id, character.identity.name]),
    );
    const label = (speakerId: string) => {
      if (speakerId === 'player') return '玩家：';
      const name = nameById.get(speakerId);
      return name ? `${name}：` : '';
    };
    setNarrative((entries) => [
      ...entries,
      ...(beat.kind === 'narrative'
        ? ([
            { id: `beat_${beat.beatId}`, text: beat.narration, kind: 'transition' as const },
            ...beat.dialogues.map((dialogue, index) => ({
              id: `beat_${beat.beatId}_${index}`,
              text: `${label(dialogue.speakerId)}${dialogue.text}`,
              kind: 'transition' as const,
            })),
          ] as NarrativeEntry[])
        : beat.intro
          ? [{ id: `beat_${beat.beatId}`, text: beat.intro, kind: 'scenario' as const }]
          : []),
    ]);
  };

  const startGame = useCallback(async () => {
    setBusy(true);
    setError(null);
    const result = await api.start();
    if (result.ok && result.data) {
      setState(result.data);
      stateRef.current = result.data;
      setNarrative([]);
      setOptions([]);
      setLastReaction('');
      setPhase('idle');
      setAutoPlay(false);
    } else {
      setError(result.error ?? '启动失败');
    }
    setBusy(false);
  }, [api]);

  const nextTurn = useCallback(async () => {
    setBusy(true);
    setError(null);
    const result = await api.nextTurn();
    if (result.ok && result.data) {
      const data = result.data;
      applyState(data.state);
      if (data.beat) appendBeat(data.beat, data.state);
      setOptions(data.options);
      setPhase(data.flowPhase ?? 'idle');
    } else {
      setError(result.error ?? '生成失败');
    }
    setBusy(false);
  }, [api]);

  /** P0.5：推进下一文段拍。 */
  const advance = useCallback(async () => {
    setBusy(true);
    setError(null);
    const result = await api.advance();
    if (result.ok && result.data) {
      appendBeat(result.data.beat, result.data.state);
      applyState(result.data.state);
      setOptions(result.data.options);
      setPhase(result.data.flowPhase);
    } else {
      setError(result.error ?? '推进失败');
    }
    setBusy(false);
  }, [api]);

  // 自动连播：文段阶段自动推进；选择点必停（phase 变为 awaiting-choice）。
  useEffect(() => {
    if (!autoPlay || phase !== 'awaiting-advance' || busy) return;
    const timer = setTimeout(() => void advance(), 350);
    return () => clearTimeout(timer);
  }, [autoPlay, phase, busy, advance]);

  const chooseOption = useCallback(
    async (optionId: string) => {
      setBusy(true);
      setError(null);
      const result = await api.choose(optionId);
      if (result.ok && result.data) {
        applyState(result.data.state);
        setOptions([]);
        setLastReaction(result.data.reactionText);
        setPhase('idle');
        setNarrative((entries) => [
          ...entries,
          { id: `reaction_${result.data!.turnResult.turnId}`, text: result.data!.reactionText },
        ]);
      } else {
        setError(result.error ?? '选择失败');
      }
      setBusy(false);
    },
    [api],
  );

  const save = useCallback(async () => {
    const saveId = `save_${Date.now()}`;
    const result = await api.save(saveId);
    if (result.ok) setLastSaveId(saveId);
    setError(result.ok ? '已保存' : (result.error ?? '保存失败'));
  }, [api]);

  const load = useCallback(async () => {
    if (!lastSaveId) {
      setError('暂无存档');
      return;
    }
    const result = await api.load(lastSaveId);
    if (result.ok && result.data) {
      setState(result.data);
      setOptions([]);
      setNarrative([]);
      setLastReaction('');
    }
    setError(result.ok ? '已读档' : (result.error ?? '读档失败'));
  }, [api, lastSaveId]);

  const exportGame = useCallback(async () => {
    const result = await api.exportGame();
    setError(result.ok ? '已导出（见控制台）' : (result.error ?? '导出失败'));
    if (result.ok && result.data) console.info(result.data);
  }, [api]);

  useEffect(() => {
    void startGame();
  }, [startGame]);

  const character = Object.values(state?.characters ?? {})[0];
  const currentLocation = state?.world.locations[state.world.currentLocationId];

  return (
    <main style={{ padding: 16 }}>
      <Background locationName={currentLocation?.name} />
      <h1>AI GALGAME Player</h1>
      <StatusBar state={state} />
      {character ? (
        <>
          <CharacterPortrait name={character.identity.name} emotion={character.emotion.primary} />
          <StrategyHint
            independence={character.personality.independence}
            empathy={character.personality.empathy}
          />
        </>
      ) : null}
      <NarrativePanel entries={narrative} />
      {lastReaction ? <Typewriter text={lastReaction} speed={20} /> : null}
      <FlowControls
        phase={phase}
        autoPlay={autoPlay}
        busy={busy}
        onToggleAuto={() => setAutoPlay((value) => !value)}
        onAdvance={() => void advance()}
      />
      <OptionList options={options} onSelect={(id) => void chooseOption(id)} disabled={busy} />
      <RelationshipPanel state={state} />
      <CgGallery endings={state?.meta.endingsDiscovered ?? []} />
      <AudioPanel />
      <SavePanel
        onSave={() => void save()}
        onLoad={() => void load()}
        onExport={() => void exportGame()}
        disabled={!state}
      />
      {phase === 'idle' && !options.length && !busy && state ? (
        <button type="button" onClick={() => void nextTurn()}>
          下一回合
        </button>
      ) : null}
      <div>
        <button type="button" disabled={busy} onClick={() => void startGame()}>
          重新开始
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
