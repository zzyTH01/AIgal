import { useMemo, useState } from 'react';
import type { GameProject } from '@ag/schemas';
import { compileCharacter } from '@ag/st-adapter';
import { GameRuntime, projectToRuntimeConfig } from '@ag/runtime';
import { ProjectForm, type ProjectFormData } from './components/ProjectForm.js';
import { createBlankProject, exportProjectJson, importProjectJson } from './project-factory.js';

export function App() {
  const [form, setForm] = useState<ProjectFormData>({
    projectName: '雨天的图书馆',
    characterName: 'Mio',
    age: 19,
    role: '图书管理员',
    description: '安静但观察力敏锐的图书管理员。',
    worldName: '图书馆',
    prompt: '保持角色一致性；输出双通道结构。',
  });
  const [project, setProject] = useState<GameProject>(() => createBlankProject());
  const [json, setJson] = useState('');
  const [preview, setPreview] = useState('');
  const [simulation, setSimulation] = useState('');
  const [error, setError] = useState('');

  const buildProject = useMemo<GameProject>(() => {
    const blank = createBlankProject();
    const character = structuredClone(blank.characters[0]!);
    character.characterId = `char_${sanitizeId(form.characterName)}`;
    character.identity = {
      ...character.identity,
      name: form.characterName,
      age: form.age,
      role: form.role,
      description: form.description,
    };
    return {
      ...blank,
      projectId: `project_${form.projectName}`,
      name: form.projectName,
      world: { ...blank.world, name: form.worldName },
      prompts: { system: form.prompt },
      characters: [character],
    };
  }, [form]);

  const compile = () => {
    try {
      const compiled = compileCharacter(buildProject.characters[0]!);
      setProject(buildProject);
      setPreview(
        `Card: ${compiled.card.data.name} ｜ WorldBook entries: ${Object.keys(compiled.worldBook.entries).length} ｜ Character: ${compiled.gameCharacter.status}`,
      );
      setJson(exportProjectJson(buildProject));
      setError('');
    } catch (err) {
      setError(String(err));
    }
  };

  const importFromJson = () => {
    try {
      const imported = importProjectJson(json);
      setProject(imported);
      setPreview(`Imported: ${imported.name}（${imported.characters.length} 角色）`);
      setError('');
    } catch (err) {
      setError(String(err));
    }
  };

  const simulate = async () => {
    try {
      setPreview('');
      setSimulation('模拟中...');
      const runtime = new GameRuntime(projectToRuntimeConfig(buildProject));
      runtime.startGame();
      const turn = await runtime.startTurn();
      const choice = await runtime.chooseOption(turn.options[0]!.id);
      setSimulation(`模拟完成：Day ${choice.state.run.day} / Turn ${choice.state.run.turn}`);
      setError('');
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <main style={{ padding: 16 }}>
      <h1>AI GALGAME Designer</h1>
      <span data-testid="project-name">{project.name}</span>
      <ProjectForm data={form} onChange={setForm} />
      <button type="button" onClick={compile}>
        编译项目
      </button>
      <button type="button" onClick={() => void simulate()}>
        模拟一回合
      </button>
      <button type="button" onClick={importFromJson}>
        从 JSON 导入
      </button>
      <pre data-testid="project-preview">{preview || simulation || '尚未编译'}</pre>
      <textarea
        aria-label="project-json"
        value={json}
        onChange={(event) => setJson(event.target.value)}
        rows={10}
        style={{ width: '100%' }}
      />
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}

function sanitizeId(value: string): string {
  const sanitized = value.trim().replace(/\s+/g, '_');
  return sanitized || 'character';
}
