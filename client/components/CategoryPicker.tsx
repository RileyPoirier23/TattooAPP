// Pick one or more business categories (tattoo, barber, nails…) as a row of toggle chips, with a required first
// pick when `min` is 1. Used at sign-up, when switching on pro features and on the pro's profile.
import React from 'react';
import { CategoryIcon } from './Icons';
import { cx } from './ui';

export const CategoryPicker: React.FC<{
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  hint?: string;
  /** The main category, shown first on cards. Click a selected chip twice to make it the main one. */
  primary?: string;
  onPrimary?: (c: string) => void;
}> = ({ options, value, onChange, label = 'What do you do?', hint, primary, onPrimary }) => {
  const toggle = (c: string) => {
    if (value.includes(c)) {
      if (onPrimary && primary !== c && value.length > 1) return onPrimary(c);
      onChange(value.filter(v => v !== c));
    } else onChange([...value, c]);
  };
  const all = value.every(v => options.includes(v)) ? options : [...value.filter(v => !options.includes(v)), ...options];
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {all.map(c => {
          const on = value.includes(c);
          const main = on && (primary ? primary === c : value[0] === c) && value.length > 1;
          return (
            <button
              type="button"
              key={c}
              onClick={() => toggle(c)}
              aria-pressed={on}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors select-none',
                on ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-medium' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400',
              )}
            >
              <CategoryIcon category={c} className="w-4 h-4" />
              {c}
              {main && <span className="text-[10px] uppercase tracking-wide opacity-80">main</span>}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-brand-gray mt-2">{hint ?? (value.length > 1 ? 'Clients find you under each one. Tap a selected category again to make it your main one.' : 'Pick everything you offer; you can choose more than one.')}</p>
    </div>
  );
};
