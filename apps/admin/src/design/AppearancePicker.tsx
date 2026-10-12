import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { AppearancePref, getAppearance, setAppearance, subscribeAppearance } from './appearance';

const OPTIONS: Array<{ value: AppearancePref; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** Segmented Light / Dark / System control. Reads and writes the real persisted preference. */
export function AppearancePicker() {
  const [pref, setPref] = useState<AppearancePref>(() => getAppearance());
  useEffect(() => subscribeAppearance((p) => setPref(p)), []);

  return (
    <div className="lg-segmented" role="radiogroup" aria-label="Appearance">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = pref === value;
        return (
          <button
            key={value}
            id={`appearance-${value}`}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`lg-segmented-item ${selected ? 'is-selected' : ''}`}
            onClick={() => {
              setAppearance(value);
              setPref(value);
            }}
          >
            <Icon size={16} strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
