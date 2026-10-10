// Month calendar used to pick dates (booking requests, days off).
import React, { useState } from 'react';
import { parseDate, toDateStr, today } from '../lib/format';
import { ArrowLeftIcon, ArrowRightIcon } from './Icons';
import { cx } from './ui';

export const Calendar: React.FC<{
  selected: string[];
  onSelect: (date: string) => void;
  isDisabled?: (date: string) => boolean;
  /** Optional extra styling per date (e.g. marked days off). */
  isMarked?: (date: string) => boolean;
  markedLabel?: string;
  initialMonth?: string;
}> = ({ selected, onSelect, isDisabled, isMarked, markedLabel, initialMonth }) => {
  const start = parseDate(initialMonth || selected[0] || today());
  const [year, setYear] = useState(start.getFullYear());
  const [month, setMonth] = useState(start.getMonth());
  const now = new Date();
  const canGoBack = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth());

  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(firstDay).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(toDateStr(new Date(year, month, d)));
  const todayStr = today();

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => shift(-1)} disabled={!canGoBack} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30" aria-label="Previous month">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <span className="font-bold">{new Date(year, month).toLocaleString(undefined, { month: 'long', year: 'numeric' })}</span>
        <button type="button" onClick={() => shift(1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Next month">
          <ArrowRightIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-brand-gray mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} />;
          const disabled = date < todayStr || !!isDisabled?.(date);
          const sel = selected.includes(date);
          const marked = isMarked?.(date);
          return (
            <button
              type="button"
              key={date}
              disabled={disabled}
              onClick={() => onSelect(date)}
              aria-pressed={sel}
              aria-label={parseDate(date).toDateString()}
              className={cx(
                'aspect-square rounded-lg text-sm font-medium transition',
                sel && 'bg-brand-primary text-on-primary',
                !sel && marked && 'bg-red-500/15 text-red-600 dark:text-red-400 line-through',
                !sel && !marked && !disabled && 'hover:bg-brand-primary/10',
                !sel && date === todayStr && 'ring-1 ring-brand-primary',
                disabled && !marked && 'text-gray-300 dark:text-gray-700 cursor-not-allowed',
              )}
            >
              {parseDate(date).getDate()}
            </button>
          );
        })}
      </div>
      {markedLabel && (
        <p className="text-xs text-brand-gray mt-2 flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded bg-red-500/30" /> {markedLabel}
        </p>
      )}
    </div>
  );
};
