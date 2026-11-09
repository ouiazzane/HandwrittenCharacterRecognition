import { CaseSensitive, Hash, WholeWord } from "lucide-react";
import type { AllowedType } from "../types";

const modes: { value: AllowedType; label: string; Icon: typeof Hash }[] = [
  { value: "digits", label: "Digits", Icon: Hash },
  { value: "letters", label: "Letters", Icon: CaseSensitive },
  { value: "all", label: "Both", Icon: WholeWord },
];

interface CharacterTypeControlProps {
  allowed: AllowedType;
  onChange: (allowed: AllowedType) => void;
  showLowercase: boolean;
  onShowLowercaseChange: (show: boolean) => void;
}

export function CharacterTypeControl({
  allowed,
  onChange,
  showLowercase,
  onShowLowercaseChange,
}: CharacterTypeControlProps) {
  return (
    <div className="character-type-control">
      <div className="character-type-heading">
        <span>CHARACTER TYPE</span>
        {allowed === "letters" && (
          <label className="lowercase-toggle" title="Uppercase and lowercase look-alike classes are merged in EMNIST; this changes display only.">
            <input
              type="checkbox"
              checked={showLowercase}
              onChange={(event) => onShowLowercaseChange(event.target.checked)}
            />
            <span>Show lowercase</span>
            <span className="lowercase-help" aria-label="Display option only; the model merges look-alike letter cases." title="The model merges look-alike letter cases. This changes display only.">?</span>
          </label>
        )}
      </div>
      <div className="character-type-options" role="group" aria-label="Filter character type">
        {modes.map(({ value, label, Icon }) => (
          <button
            type="button"
            className={`character-type-option ${allowed === value ? "character-type-selected" : ""}`}
            key={value}
            onClick={() => onChange(value)}
            aria-pressed={allowed === value}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      <p className="character-type-hint">Choose Digits to avoid 9/g, 1/7, 0/O confusions</p>
    </div>
  );
}
