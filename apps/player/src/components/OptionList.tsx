import type { Option } from '@ag/schemas';

export function OptionList({
  options,
  onSelect,
  disabled = false,
}: {
  options: Option[];
  onSelect: (optionId: string) => void;
  disabled?: boolean;
}) {
  return (
    <div data-testid="option-list">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(option.id)}
        >
          {option.presentation.text}
        </button>
      ))}
    </div>
  );
}
