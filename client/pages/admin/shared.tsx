// Small building blocks shared by the admin sections.
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../../api';
import { useStore } from '../../store';
import { Button, ErrorBox, Modal, PageLoader, Spinner, cx, inputClass, Field, useApi } from '../../components/ui';
import { PhotoIcon, SearchIcon, TrashIcon, UploadIcon, XIcon } from '../../components/Icons';
import { prepareImage } from '../../lib/images';

// ---------- Actions ----------

/**
 * Runs async admin actions with a per-key loading flag and success/error toasts.
 * `run` resolves to true on success so callers can close modals etc.
 */
export function useRunner() {
  const toast = useStore(s => s.toast);
  const [busyKeys, setBusyKeys] = useState<Record<string, boolean>>({});
  const run = useCallback(
    async (key: string, fn: () => Promise<unknown>, success?: string): Promise<boolean> => {
      setBusyKeys(b => ({ ...b, [key]: true }));
      try {
        await fn();
        if (success) toast(success, 'success');
        return true;
      } catch (err) {
        toast(errorMessage(err), 'error');
        return false;
      } finally {
        setBusyKeys(b => {
          const next = { ...b };
          delete next[key];
          return next;
        });
      }
    },
    [toast],
  );
  const busy = useCallback((key: string) => !!busyKeys[key], [busyKeys]);
  return { run, busy, anyBusy: Object.keys(busyKeys).length > 0 };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export { confirmLeave, hasUnsavedChanges, useUnsavedWarning } from '../../lib/unsaved';

const COUNTS_EVENT = 'inkspace:admin-counts';

/** Tells the admin layout to refresh its badge counts (pending verifications/reports). */
export const refreshAdminCounts = () => window.dispatchEvent(new Event(COUNTS_EVENT));

export function useAdminCountsListener(onRefresh: () => void) {
  const ref = useRef(onRefresh);
  useLayoutEffect(() => {
    ref.current = onRefresh;
  });
  useEffect(() => {
    const handler = () => ref.current();
    window.addEventListener(COUNTS_EVENT, handler);
    return () => window.removeEventListener(COUNTS_EVENT, handler);
  }, []);
}

/** An <a> styled like an outline button (for downloads and links that open in a new tab). */
export const LinkButton: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement> & { primary?: boolean }> = ({ className, primary, children, ...rest }) => (
  <a
    className={cx(
      'inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
      primary
        ? 'bg-brand-solid text-on-primary hover:brightness-110'
        : 'border border-gray-300 dark:border-gray-700 text-brand-dark dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800',
      className,
    )}
    {...rest}
  >
    {children}
  </a>
);

// ---------- Modals ----------

type ModalProps = React.ComponentProps<typeof Modal>;

/** Modal with a stable onClose (so typing inside it never loses focus when the parent re-renders). */
export const Dialog: React.FC<ModalProps> = ({ onClose, ...rest }) => {
  const ref = useRef(onClose);
  useLayoutEffect(() => {
    ref.current = onClose;
  });
  const stableClose = useCallback(() => ref.current(), []);
  return <Modal {...rest} onClose={stableClose} />;
};

/** A yes/no confirmation. `onConfirm` resolves to false to keep the dialog open (e.g. on error). */
export const ConfirmModal: React.FC<{
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  variant?: 'danger' | 'primary' | 'success';
  onConfirm: () => Promise<boolean | void>;
  onClose: () => void;
}> = ({ title, children, confirmLabel = 'Confirm', variant = 'danger', onConfirm, onClose }) => {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    const ok = await onConfirm();
    if (ok === false) setBusy(false);
    else onClose();
  };
  return (
    <Dialog
      title={title}
      size="sm"
      onClose={onClose}
      closeDisabled={busy}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={variant} loading={busy} onClick={confirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-gray-700 dark:text-gray-300 space-y-3">{children}</div>
    </Dialog>
  );
};

// ---------- Data loading ----------

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  reload: () => Promise<void> | void;
}

/** Shows a loader, an error with retry, or the content once data has arrived. */
export function AsyncView<T>({ state, children }: { state: AsyncState<T>; children: (data: T) => React.ReactNode }) {
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    setRetrying(true);
    try {
      await state.reload();
    } finally {
      setRetrying(false);
    }
  };
  if (state.data === null) {
    if (state.error && !retrying) return <ErrorBox message={state.error} onRetry={retry} />;
    return <PageLoader />;
  }
  return (
    <>
      {state.error && (
        <div className="mb-4">
          <ErrorBox message={state.error} onRetry={retry} />
        </div>
      )}
      {children(state.data)}
    </>
  );
}

// ---------- Tables & filters ----------

export const DataTable: React.FC<{ columns: React.ReactNode[]; children: React.ReactNode; className?: string }> = ({ columns, children, className }) => (
  <div className={cx('overflow-x-auto', className)}>
    <table className="min-w-full text-sm text-left">
      <thead className="bg-gray-50 dark:bg-gray-800/40 text-xs uppercase tracking-wide text-brand-gray">
        <tr>
          {columns.map((c, i) => (
            <th key={i} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{children}</tbody>
    </table>
  </div>
);

export const Td: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className, children, ...rest }) => (
  <td className={cx('px-4 py-3 align-top text-brand-dark dark:text-gray-200', className)} {...rest}>
    {children}
  </td>
);

export const Muted: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <span className={cx('block text-xs text-brand-gray', className)}>{children}</span>
);

export const SearchInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; loading?: boolean; className?: string }> = ({
  value, onChange, placeholder = 'Search…', loading, className,
}) => (
  <div className={cx('relative', className)}>
    <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray pointer-events-none" />
    <input
      type="search"
      enterKeyHint="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={cx(inputClass, 'pl-9 pr-9')}
    />
    <span className="absolute right-3 top-1/2 -translate-y-1/2 flex">
      {loading ? (
        <Spinner size="sm" />
      ) : (
        value && (
          <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="text-brand-gray hover:text-brand-dark dark:hover:text-white">
            <XIcon className="w-4 h-4" />
          </button>
        )
      )}
    </span>
  </div>
);

export const FilterPills: React.FC<{
  options: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}> = ({ options, value, onChange, className }) => (
  <div className={cx('flex gap-2 overflow-x-auto scrollbar-hide', className)} role="tablist">
    {options.map(o => (
      <button
        key={o.id}
        type="button"
        role="tab"
        aria-selected={value === o.id}
        onClick={() => onChange(o.id)}
        className={cx(
          'px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors',
          value === o.id
            ? 'bg-brand-solid text-on-primary border-transparent'
            : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
        )}
      >
        {o.label}
        {!!o.count && (
          <span className={cx('ml-1.5 text-xs rounded-full px-1.5', value === o.id ? 'bg-white/25' : 'bg-brand-primary/15 text-brand-primary')}>{o.count}</span>
        )}
      </button>
    ))}
  </div>
);

// ---------- Paged lists ----------

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Loads one page of an admin list. Changing any filter goes back to page 1.
 * Empty filters are left out of the request.
 */
export function usePaged<R extends Paged<unknown>>(base: string, filters: Record<string, string>) {
  const key = JSON.stringify(filters);
  const [state, setState] = useState({ key, page: 1 });
  const page = state.key === key ? state.page : 1;
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== ''));
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  const api = useApi<R>(`${base}${qs ? `?${qs}` : ''}`);
  // Jump back to the top once the new page has loaded (scrolling earlier gets cut short as the page changes height).
  const scrollWhenLoaded = useRef(false);
  const setPage = useCallback((p: number) => {
    scrollWhenLoaded.current = true;
    setState({ key, page: p });
  }, [key]);
  useEffect(() => {
    if (scrollWhenLoaded.current && api.data) {
      scrollWhenLoaded.current = false;
      window.scrollTo(0, 0);
    }
  }, [api.data]);
  // If the last item on a later page was removed, step back to the previous page instead of showing it empty.
  const emptyLaterPage = !!api.data && api.data.items.length === 0 && page > 1;
  useEffect(() => {
    if (emptyLaterPage) setState({ key, page: page - 1 });
  }, [emptyLaterPage, key, page]);
  return { ...api, page, setPage };
}

/** "21–40 of 230" with previous/next buttons. */
export const Pager: React.FC<{ page: number; pageSize: number; total: number; onPage: (page: number) => void; noun?: string }> = ({
  page, pageSize, total, onPage, noun,
}) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-brand-gray border-t border-gray-100 dark:border-gray-800">
      <span>
        {pages > 1 ? `${from}–${to} of ${total}` : total} {noun}
      </span>
      {pages > 1 && (
        <span className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            Previous
          </Button>
          <span aria-live="polite">
            Page {page} of {pages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            Next
          </Button>
        </span>
      )}
    </div>
  );
};

/** Search box with filters next to it on wide screens (stacked on smaller ones). */
export const Toolbar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col xl:flex-row xl:items-center gap-3 mb-4">{children}</div>
);

// ---------- Settings forms ----------

/** A titled group of settings with an optional description. */
export const SettingsCard: React.FC<{ title: string; description?: React.ReactNode; icon?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }> = ({
  title, description, icon, children, aside,
}) => (
  <section className="bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 sm:p-6">
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex items-start gap-3">
        {icon && <span className="w-9 h-9 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center flex-shrink-0">{icon}</span>}
        <div>
          <h2 className="text-lg font-bold text-brand-dark dark:text-white">{title}</h2>
          {description && <p className="text-sm text-brand-gray mt-0.5">{description}</p>}
        </div>
      </div>
      {aside}
    </div>
    <div className="space-y-5">{children}</div>
  </section>
);

/** Floating bar shown while a settings form has unsaved changes. */
export const SaveBar: React.FC<{ dirty: boolean; saving: boolean; canSave?: boolean; problem?: string | null; onSave: () => void; onDiscard: () => void }> = ({
  dirty, saving, canSave = true, problem, onSave, onDiscard,
}) => {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 mt-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-brand-primary/40 bg-white dark:bg-gray-900 px-4 py-3 shadow-xl">
        <p className="text-sm font-medium text-brand-dark dark:text-white">
          {problem ? <span className="text-red-600 dark:text-red-400">{problem}</span> : 'You have unsaved changes.'}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
          <Button onClick={onSave} loading={saving} disabled={!canSave}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Upload/replace/remove an image; `value` is the image URL. */
export const ImageField: React.FC<{
  label: string;
  hint?: React.ReactNode;
  value: string;
  onChange: (url: string) => void;
  previewClassName?: string;
}> = ({ label, hint, value, onChange, previewClassName = 'h-24 w-full sm:w-48' }) => {
  const toast = useStore(s => s.toast);
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = async (picked: File | undefined) => {
    if (!picked) return;
    if (!/^image\/(png|jpe?g|gif|webp)$/i.test(picked.type)) return toast('Please choose a JPG, PNG, GIF or WebP image.', 'error');
    const file = await prepareImage(picked);
    if (file.size > MAX_UPLOAD_BYTES) return toast('That image is too large (max 8 MB).', 'error');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { url } = await api.post<{ url: string }>('/admin/upload', fd);
      onChange(url);
      toast('Image uploaded. Remember to save your changes.', 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div
          className={cx(
            'relative rounded-xl border border-dashed border-gray-300 dark:border-gray-700 overflow-hidden flex items-center justify-center bg-gray-50 dark:bg-gray-800/50',
            previewClassName,
          )}
        >
          {value ? (
            <img src={value} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs text-brand-gray">
              <PhotoIcon className="w-6 h-6" />
              No image
            </span>
          )}
          {uploading && (
            <span className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Spinner light />
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
          <Button variant="outline" size="sm" onClick={() => input.current?.click()} loading={uploading}>
            {!uploading && <UploadIcon className="w-4 h-4" />}
            {value ? 'Replace' : 'Upload'}
          </Button>
          {value && (
            <Button variant="ghost" size="sm" onClick={() => onChange('')} disabled={uploading}>
              <TrashIcon className="w-4 h-4" />
              Remove
            </Button>
          )}
        </div>
      </div>
    </Field>
  );
};
