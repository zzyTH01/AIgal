export interface ProjectFormData {
  projectName: string;
  characterName: string;
  age: number;
  role: string;
  description: string;
  worldName: string;
  locationName: string;
  dayLength: number;
  eventTitle: string;
  endingTitle: string;
  prompt: string;
}

export function ProjectForm({
  data,
  onChange,
}: {
  data: ProjectFormData;
  onChange: (data: ProjectFormData) => void;
}) {
  const set = (patch: Partial<ProjectFormData>) => onChange({ ...data, ...patch });
  return (
    <form data-testid="project-form">
      <label>
        项目名
        <input
          value={data.projectName}
          onChange={(event) => set({ projectName: event.target.value })}
        />
      </label>
      <label>
        角色名
        <input
          value={data.characterName}
          onChange={(event) => set({ characterName: event.target.value })}
        />
      </label>
      <label>
        年龄
        <input
          type="number"
          min={18}
          value={data.age}
          onChange={(event) => set({ age: Number(event.target.value) })}
        />
      </label>
      <label>
        角色定位
        <input value={data.role} onChange={(event) => set({ role: event.target.value })} />
      </label>
      <label>
        角色描述
        <textarea
          value={data.description}
          onChange={(event) => set({ description: event.target.value })}
        />
      </label>
      <label>
        世界名
        <input
          value={data.worldName}
          onChange={(event) => set({ worldName: event.target.value })}
        />
      </label>
      <label>
        系统 Prompt
        <textarea value={data.prompt} onChange={(event) => set({ prompt: event.target.value })} />
      </label>
    </form>
  );
}
