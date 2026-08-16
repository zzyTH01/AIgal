export function SavePanel({
  onSave,
  onExport,
  disabled = false,
}: {
  onSave: () => void;
  onExport: () => void;
  disabled?: boolean;
}) {
  return (
    <div data-testid="save-panel">
      <button type="button" disabled={disabled} onClick={onSave}>
        保存
      </button>
      <button type="button" disabled={disabled} onClick={onExport}>
        导出
      </button>
    </div>
  );
}
