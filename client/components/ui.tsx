// Shared UI building blocks used across the site and the admin panel.
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { api, errorMessage } from '../api';
import { StarIcon, XIcon } from './Icons';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

// ---------- Buttons ----------

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-solid text-on-primary hover:brightness-110 shadow-sm shadow-brand-primary/20',
  secondary: 'bg-brand-secondary-solid text-on-secondary hover:brightness-110',
  outline: 'border border-gray-300 dark:border-gray-700 text-brand-dark dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800',
  ghost: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
  danger: 'bg-red-600 text-white hover:bg-red-500',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500',
};
const SIZES = { sm: 'text-sm px-3 py-1.5 rounded-lg', md: 'text-sm px-4 py-2.5 rounded-lg', lg: 'text-base px-6 py-3 rounded-xl' };

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: keyof typeof SIZES; loading?: boolean; block?: boolean }
> = ({ variant = 'primary', size = 'md', loading, block, className, children, disabled, type = 'button', ...rest }) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={cx(
      'inline-flex items-center justify-center gap-2 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-brand-dark',
      VARIANTS[variant],
      SIZES[size],
      block && 'w-full',
      className,
    )}
    {...rest}
  >
    {loading && <Spinner size="sm" light={variant !== 'outline' && variant !== 'ghost'} />}
    {children}
  </button>
);

// ---------- Form fields ----------

export const inputClass =
  'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-brand-dark dark:text-white placeholder:text-gray-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 focus:outline-none disabled:opacity-60';

export const Field: React.FC<{ label?: React.ReactNode; hint?: React.ReactNode; error?: string; htmlFor?: string; className?: string; children: React.ReactNode }> = ({
  label, hint, error, htmlFor, className, children,
}) => (
  <div className={className}>
    {label && (
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
    )}
    {children}
    {hint && !error && <p className="mt-1 text-xs text-brand-gray">{hint}</p>}
    {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
  </div>
);

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode; hint?: React.ReactNode; error?: string; prefix?: string };
export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, hint, error, prefix, className, id, ...rest }, ref) => {
  const auto = useId();
  const inputId = id || auto;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} className={className}>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray text-sm">{prefix}</span>}
        <input ref={ref} id={inputId} className={cx(inputClass, prefix && 'pl-7')} {...rest} />
      </div>
    </Field>
  );
});

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: React.ReactNode; hint?: React.ReactNode; error?: string }> = ({
  label, hint, error, className, id, rows = 4, ...rest
}) => {
  const auto = useId();
  const inputId = id || auto;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} className={className}>
      <textarea id={inputId} rows={rows} className={inputClass} {...rest} />
    </Field>
  );
};

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: React.ReactNode; hint?: React.ReactNode; error?: string }> = ({
  label, hint, error, className, id, children, ...rest
}) => {
  const auto = useId();
  const inputId = id || auto;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} className={className}>
      <select id={inputId} className={inputClass} {...rest}>
        {children}
      </select>
    </Field>
  );
};

export const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  /** Name for screen readers when there's no visible label (e.g. in a table). */
  ariaLabel?: string;
}> = ({ checked, onChange, label, description, disabled, ariaLabel }) => (
  <label className={cx('flex items-start justify-between gap-4 cursor-pointer', disabled && 'opacity-50 cursor-not-allowed')}>
    {(label || description) && (
      <span>
        {label && <span className="block font-medium text-brand-dark dark:text-white">{label}</span>}
        {description && <span className="block text-sm text-brand-gray">{description}</span>}
      </span>
    )}
    <span className="relative inline-flex flex-shrink-0 mt-0.5">
      <input type="checkbox" role="switch" aria-label={ariaLabel} className="sr-only peer" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span className="w-11 h-6 rounded-full bg-gray-300 dark:bg-gray-700 peer-checked:bg-brand-primary transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-primary" />
      <span className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
    </span>
  </label>
);

// ---------- Layout ----------

export const Card: React.FC<{ className?: string; children: React.ReactNode; padded?: boolean }> = ({ className, children, padded = true }) => (
  <div className={cx('bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl', padded && 'p-5 sm:p-6', className)}>{children}</div>
);

export const PageHeader: React.FC<{ title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
    <div>
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-dark dark:text-white">{title}</h1>
      {subtitle && <p className="text-brand-gray mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

export const SectionTitle: React.FC<{ children: React.ReactNode; count?: number; actions?: React.ReactNode }> = ({ children, count, actions }) => (
  <div className="flex items-center justify-between gap-3 mb-4">
    <h2 className="text-xl font-bold text-brand-dark dark:text-white flex items-center gap-2">
      {children}
      {!!count && <span className="text-xs font-bold bg-brand-primary/15 text-brand-primary rounded-full px-2 py-0.5">{count}</span>}
    </h2>
    {actions}
  </div>
);

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; children?: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="text-center py-12 px-4">
    {icon && <div className="mx-auto mb-3 w-12 h-12 text-gray-400 dark:text-gray-600">{icon}</div>}
    <h3 className="text-lg font-semibold text-brand-dark dark:text-white">{title}</h3>
    {children && <div className="text-brand-gray mt-1 text-sm">{children}</div>}
  </div>
);

const TONES = {
  green: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-400',
  yellow: 'bg-amber-500/15 text-amber-800 dark:text-amber-400',
  red: 'bg-red-500/15 text-red-700 dark:text-red-400',
  blue: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  purple: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
  gray: 'bg-gray-500/15 text-gray-700 dark:text-gray-400',
  brand: 'bg-brand-primary/15 text-brand-primary',
};
export type Tone = keyof typeof TONES;
export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string }> = ({ tone = 'gray', children, className }) => (
  <span className={cx('inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap', TONES[tone], className)}>{children}</span>
);

const STATUS: Record<string, [Tone, string]> = {
  pending: ['yellow', 'Pending'],
  approved: ['green', 'Approved'],
  declined: ['red', 'Declined'],
  cancelled: ['gray', 'Cancelled'],
  completed: ['blue', 'Completed'],
  'no-show': ['red', 'No-show'],
  paid: ['green', 'Paid'],
  unpaid: ['yellow', 'Awaiting payment'],
  refunded: ['purple', 'Refunded'],
  resolved: ['green', 'Resolved'],
  dismissed: ['gray', 'Dismissed'],
  rejected: ['red', 'Rejected'],
  active: ['green', 'Active'],
  suspended: ['red', 'Suspended'],
};
export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const [tone, label] = STATUS[status] || ['gray', status];
  return <Badge tone={tone}>{label}</Badge>;
};

export const Tabs: React.FC<{ tabs: { id: string; label: React.ReactNode; count?: number }[]; active: string; onChange: (id: string) => void; className?: string }> = ({
  tabs, active, onChange, className,
}) => (
  <div className={cx('flex gap-1 overflow-x-auto scrollbar-hide border-b border-gray-200 dark:border-gray-800', className)}>
    {tabs.map(t => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        className={cx(
          'px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors',
          active === t.id ? 'border-brand-primary text-brand-primary' : 'border-transparent text-brand-gray hover:text-brand-dark dark:hover:text-white',
        )}
      >
        {t.label}
        {!!t.count && <span className="ml-1.5 text-xs bg-brand-solid text-on-primary rounded-full px-1.5 py-0.5">{t.count}</span>}
      </button>
    ))}
  </div>
);

// ---------- Feedback ----------

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; light?: boolean }> = ({ size = 'md', light }) => (
  <span
    role="status"
    aria-label="Loading"
    className={cx(
      'inline-block rounded-full animate-spin border-t-transparent',
      { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-[3px]', lg: 'w-12 h-12 border-4' }[size],
      light ? 'border-white border-t-transparent' : 'border-brand-primary border-t-transparent',
    )}
  />
);

export const PageLoader: React.FC = () => (
  <div className="flex justify-center items-center py-24">
    <Spinner size="lg" />
  </div>
);

export const ErrorBox: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-300 flex items-center justify-between gap-4">
    <span>{message}</span>
    {onRetry && (
      <Button size="sm" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);

export const Notice: React.FC<{ tone?: 'info' | 'warning' | 'success'; children: React.ReactNode; className?: string }> = ({ tone = 'info', children, className }) => (
  <div
    className={cx(
      'rounded-xl border p-4 text-sm',
      tone === 'info' && 'border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200',
      tone === 'warning' && 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
      tone === 'success' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
      className,
    )}
  >
    {children}
  </div>
);

// ---------- Modal ----------

// Open dialogs, top-most last — so Escape only closes the dialog on top (e.g. a login box over a booking form).
const modalStack: symbol[] = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Modal: React.FC<{
  title: React.ReactNode;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeDisabled?: boolean;
}> = ({ title, onClose, size = 'md', children, footer, closeDisabled }) => {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Keep the latest callbacks in a ref so parent re-renders never re-run the focus effect.
  const latest = useRef({ onClose, closeDisabled });
  latest.current = { onClose, closeDisabled };
  useEffect(() => {
    const me = Symbol('modal');
    modalStack.push(me);
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== me) return;
      if (e.key === 'Escape' && !latest.current.closeDisabled) {
        e.stopPropagation();
        latest.current.onClose();
      }
      // Keep keyboard focus inside the dialog.
      if (e.key === 'Tab' && ref.current) {
        const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      modalStack.splice(modalStack.indexOf(me), 1);
      if (modalStack.length === 0) document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, []);
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
      onMouseDown={e => e.target === e.currentTarget && !closeDisabled && onClose()}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 w-full max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl animate-scale-up outline-none',
          { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[size],
        )}
      >
        <header className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 id={titleId} className="text-lg font-bold text-brand-dark dark:text-white">{title}</h2>
          <button onClick={onClose} disabled={closeDisabled} aria-label="Close" className="p-1 rounded-lg text-gray-500 hover:text-brand-dark dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40">
            <XIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-5 flex-1">{children}</div>
        {footer && <footer className="px-5 py-4 border-t border-gray-200 dark:border-gray-800 flex flex-wrap justify-end gap-2">{footer}</footer>}
      </div>
    </div>
  );
};

// ---------- Misc ----------

export const StarRating: React.FC<{ value: number; onChange?: (v: number) => void; size?: string; showValue?: boolean; count?: number }> = ({
  value, onChange, size = 'w-5 h-5', showValue, count,
}) => {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="inline-flex items-center gap-1" {...(onChange ? { role: 'radiogroup', 'aria-label': 'Rating' } : { role: 'img', 'aria-label': `Rated ${value.toFixed(1)} out of 5` })}>
      <div className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            disabled={!onChange}
            onClick={() => onChange?.(n)}
            onMouseEnter={() => onChange && setHover(n)}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            {...(onChange ? { role: 'radio', 'aria-checked': n === value } : { 'aria-hidden': true, tabIndex: -1 })}
            className={cx(onChange ? 'cursor-pointer' : 'cursor-default')}
          >
            <StarIcon className={cx(size, n <= Math.round(shown) ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600')} />
          </button>
        ))}
      </div>
      {showValue && value > 0 && <span className="text-sm font-semibold text-brand-dark dark:text-white">{value.toFixed(1)}</span>}
      {count !== undefined && <span className="text-sm text-brand-gray">({count})</span>}
    </div>
  );
};

export const Avatar: React.FC<{ name: string; url?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl' }> = ({ name, url, size = 'md' }) => {
  const s = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-16 h-16 text-xl', xl: 'w-24 h-24 text-3xl' }[size];
  if (url) return <img src={url} alt={name} className={cx(s, 'rounded-full object-cover flex-shrink-0 bg-gray-200 dark:bg-gray-800')} />;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
  return (
    <span className={cx(s, 'rounded-full flex-shrink-0 flex items-center justify-center font-bold text-on-gradient bg-gradient-to-br from-brand-solid to-brand-secondary-solid')}>
      {initials || '?'}
    </span>
  );
};

/** A photo placeholder with a gradient when there is no image. */
export const Cover: React.FC<{ url?: string | null; alt: string; className?: string }> = ({ url, alt, className }) =>
  url ? (
    <img src={url} alt={alt} loading="lazy" className={cx('object-cover bg-gray-200 dark:bg-gray-800', className)} />
  ) : (
    <div className={cx('bg-gradient-to-br from-brand-primary/40 via-brand-secondary/30 to-gray-900/50 flex items-center justify-center', className)}>
      <span className="text-5xl font-black tracking-tight text-white/80">
        {alt.split(/[\s&]+/).filter(w => /^[\p{L}\p{N}]/u.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '•'}
      </span>
    </div>
  );

// ---------- Data loading ----------

/** Fetches `url` (when not null) and re-fetches when any dependency changes. */
export function useApi<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const reqId = useRef(0);

  const load = useCallback(async (quiet = false) => {
    if (!url) return;
    const id = ++reqId.current;
    if (!quiet) setLoading(true);
    try {
      const result = await api.get<T>(url);
      if (id === reqId.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (id === reqId.current) setError(errorMessage(err));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load(data !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ...deps]);

  return { data, setData, error, loading, reload: () => load(true) };
}

/** Wraps an async action with a loading flag and error toast. */
export function useAction<A extends unknown[]>(fn: (...args: A) => Promise<unknown>, onError?: (msg: string) => void) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (...args: A) => {
      setBusy(true);
      try {
        await fn(...args);
        return true;
      } catch (err) {
        onError?.(errorMessage(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [fn, onError],
  );
  return [run, busy] as const;
}
