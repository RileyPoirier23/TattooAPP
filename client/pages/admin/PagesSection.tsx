// Admin → Pages: content pages such as FAQ, Terms and Privacy (shown at /p/<slug>).
import React, { useCallback, useMemo, useState } from 'react';
import { api } from '../../api';
import { useStore } from '../../store';
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Tabs, Toggle, cx, inputClass, useApi } from '../../components/ui';
import { ArrowLeftIcon, DocumentIcon, EditIcon, EyeIcon, PlusIcon, TrashIcon } from '../../components/Icons';
import { Markdown, fillPageTokens } from '../../lib/markdown';
import { timeAgo } from '../../lib/format';
import type { Page } from '../../../shared/types';
import { AsyncView, ConfirmModal, useRunner, useUnsavedWarning } from './shared';

const SLUG = /^[a-z0-9-]+$/;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

interface Draft {
  title: string;
  slug: string;
  body: string;
  published: boolean;
  showInFooter: boolean;
  sortOrder: number;
}

const toDraft = (p: Page | null, nextSortOrder: number): Draft =>
  p
    ? { title: p.title, slug: p.slug, body: p.body, published: p.published, showInFooter: p.showInFooter, sortOrder: p.sortOrder }
    : { title: '', slug: '', body: '', published: true, showInFooter: true, sortOrder: nextSortOrder };

const MarkdownHelp: React.FC = () => (
  <details className="text-xs text-brand-gray mt-2">
    <summary className="cursor-pointer font-semibold hover:text-brand-dark dark:hover:text-white">Formatting help</summary>
    <ul className="mt-2 space-y-1 font-mono">
      <li>## Heading &nbsp;·&nbsp; ### Smaller heading</li>
      <li>**bold** &nbsp;·&nbsp; *italic*</li>
      <li>[link text](https://example.com) &nbsp;·&nbsp; [email us](mailto:you@example.com)</li>
      <li>- bullet point &nbsp;·&nbsp; 1. numbered item</li>
    </ul>
    <p className="mt-2">Leave an empty line between paragraphs.</p>
    <p className="mt-2">
      <span className="font-mono">{'{{siteName}}'}</span>, <span className="font-mono">{'{{siteUrl}}'}</span> and <span className="font-mono">{'{{contact}}'}</span> are
      replaced with your site&apos;s name, web address and contact email (or a link to the contact form).
    </p>
  </details>
);

const PageEditor: React.FC<{ page: Page | null; nextSortOrder: number; onDone: (saved?: Page) => void; onDelete: (p: Page) => void }> = ({
  page, nextSortOrder, onDone, onDelete,
}) => {
  const initial = useMemo(() => toDraft(page, nextSortOrder), [page, nextSortOrder]);
  const [d, setD] = useState<Draft>(initial);
  const [slugTouched, setSlugTouched] = useState(!!page);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const { run, busy } = useRunner();
  const settings = useStore(s => s.config?.settings);
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  useUnsavedWarning(dirty);

  const update = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(prev => ({ ...prev, [k]: v }));
  const titleError = d.title.trim() ? undefined : 'Give the page a title.';
  const slugError = !d.slug ? 'Choose an address.' : SLUG.test(d.slug) ? undefined : 'Use lowercase letters, numbers and dashes only.';

  const save = () =>
    run(
      'save',
      async () => {
        const body = { ...d, title: d.title.trim(), sortOrder: Number.isFinite(d.sortOrder) ? Math.round(d.sortOrder) : 0 };
        const saved = page ? await api.patch<Page>(`/admin/pages/${page.id}`, body) : await api.post<Page>('/admin/pages', body);
        void useStore.getState().boot();
        onDone(saved);
      },
      page ? 'Page saved.' : 'Page created.',
    );

  const cancel = () => {
    if (dirty && !window.confirm('Discard your changes to this page?')) return;
    onDone();
  };

  return (
    <>
      <button type="button" onClick={cancel} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-gray hover:text-brand-dark dark:hover:text-white mb-4">
        <ArrowLeftIcon className="w-4 h-4" /> All pages
      </button>
      <PageHeader
        title={page ? 'Edit page' : 'New page'}
        subtitle={page ? `Last updated ${timeAgo(page.updatedAt)}` : 'Add an FAQ, policy, or any other information page.'}
        actions={
          <>
            {page && (
              <Button variant="ghost" onClick={() => onDelete(page)}>
                <TrashIcon className="w-4 h-4" /> Delete
              </Button>
            )}
            <Button variant="outline" onClick={cancel}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy('save')} disabled={!!titleError || !!slugError || (!!page && !dirty)}>
              {page ? 'Save page' : 'Create page'}
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <Card>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Title"
              value={d.title}
              maxLength={120}
              placeholder="e.g. Aftercare guide"
              error={d.title && titleError}
              onChange={e => {
                const title = e.target.value;
                setD(prev => ({ ...prev, title, slug: slugTouched ? prev.slug : slugify(title) }));
              }}
            />
            <Field label="Page address" hint={`Your page will live at ${window.location.origin}/p/${d.slug || '…'}`} error={d.slug || d.title ? slugError : undefined}>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 text-sm text-brand-gray">/p/</span>
                <input
                  className={cx(inputClass, 'rounded-l-none')}
                  value={d.slug}
                  maxLength={60}
                  placeholder="aftercare"
                  onChange={e => {
                    setSlugTouched(true);
                    update('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'));
                  }}
                />
              </div>
            </Field>
          </div>
          {page && d.slug !== page.slug && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">Changing the address will break any links people saved to the old one.</p>
          )}
        </Card>

        <Card>
          <Tabs
            className="lg:hidden mb-4"
            tabs={[
              { id: 'write', label: 'Write' },
              { id: 'preview', label: 'Preview' },
            ]}
            active={tab}
            onChange={id => setTab(id === 'preview' ? 'preview' : 'write')}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className={cx(tab !== 'write' && 'hidden lg:block')}>
              <label htmlFor="page-body" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Content
              </label>
              <textarea
                id="page-body"
                rows={18}
                maxLength={50000}
                value={d.body}
                onChange={e => update('body', e.target.value)}
                className={cx(inputClass, 'font-mono text-sm leading-relaxed')}
                placeholder={'## A heading\nWrite your text here.\n\n- A bullet point\n- Another one'}
              />
              <MarkdownHelp />
            </div>
            <div className={cx(tab !== 'preview' && 'hidden lg:block', 'min-w-0')}>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preview</p>
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 px-5 py-4 min-h-[200px] lg:max-h-[470px] overflow-y-auto">
                <h1 className="text-4xl font-display text-brand-dark dark:text-white">{d.title || 'Untitled page'}</h1>
                {d.body.trim() ? (
                  <Markdown text={settings ? fillPageTokens(d.body, settings, window.location.origin) : d.body} className="text-gray-700 dark:text-gray-300 break-words" />
                ) : (
                  <p className="text-sm text-brand-gray mt-3">Start writing to see a preview.</p>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-5">
              <Toggle
                checked={d.published}
                onChange={v => update('published', v)}
                label="Published"
                description={d.published ? 'Anyone can view this page.' : 'Draft. Only you can see it here.'}
              />
              <Toggle checked={d.showInFooter} onChange={v => update('showInFooter', v)} label="Link in footer" description="Adds a link to this page at the bottom of every page." />
            </div>
            <Input
              label="Order"
              type="number"
              step={1}
              value={Number.isFinite(d.sortOrder) ? d.sortOrder : ''}
              onChange={e => update('sortOrder', e.target.value === '' ? NaN : Number(e.target.value))}
              hint="Lower numbers are listed first in the footer."
              className="sm:max-w-[10rem]"
            />
          </div>
        </Card>
      </div>
    </>
  );
};

export const PagesSection: React.FC = () => {
  const state = useApi<Page[]>('/admin/pages');
  const [editing, setEditing] = useState<Page | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Page | null>(null);
  const { run } = useRunner();

  const nextSortOrder = (state.data ?? []).reduce((m, p) => Math.max(m, p.sortOrder + 1), 0);

  const onDone = useCallback(
    (saved?: Page) => {
      if (saved) {
        state.setData(list => {
          const rest = (list ?? []).filter(p => p.id !== saved.id);
          return [...rest, saved].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
        });
      }
      setEditing(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.setData],
  );
  const closeDelete = useCallback(() => setDeleting(null), []);

  const confirmDelete = (p: Page) =>
    run(
      'delete',
      async () => {
        await api.del(`/admin/pages/${p.id}`);
        state.setData(list => (list ?? []).filter(x => x.id !== p.id));
        void useStore.getState().boot();
        setEditing(null);
      },
      `"${p.title}" was deleted.`,
    );

  const deleteModal = deleting && (
    <ConfirmModal title="Delete this page?" confirmLabel="Delete page" onClose={closeDelete} onConfirm={() => confirmDelete(deleting)}>
      <p>
        <strong>{deleting.title}</strong> will be removed and <span className="font-mono">/p/{deleting.slug}</span> will stop working. This can&apos;t be undone.
      </p>
      <p>Tip: to hide a page without losing it, turn off &ldquo;Published&rdquo; instead.</p>
    </ConfirmModal>
  );

  if (editing) {
    return (
      <>
        <PageEditor key={editing === 'new' ? 'new' : editing.id} page={editing === 'new' ? null : editing} nextSortOrder={nextSortOrder} onDone={onDone} onDelete={setDeleting} />
        {deleteModal}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Pages"
        subtitle="FAQ, policies and other information pages. Published pages can be linked in your footer."
        actions={
          <Button onClick={() => setEditing('new')}>
            <PlusIcon className="w-4 h-4" /> New page
          </Button>
        }
      />
      <AsyncView state={state}>
        {pages =>
          pages.length === 0 ? (
            <Card>
              <EmptyState icon={<DocumentIcon className="w-12 h-12" />} title="No pages yet">
                <p>Create an FAQ, your booking policy, or your terms of service.</p>
                <Button className="mt-4" onClick={() => setEditing('new')}>
                  <PlusIcon className="w-4 h-4" /> New page
                </Button>
              </EmptyState>
            </Card>
          ) : (
            <Card padded={false} className="divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
              {pages.map(p => (
                <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
                  <button type="button" onClick={() => setEditing(p)} className="flex-1 min-w-0 text-left group">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-brand-dark dark:text-white group-hover:text-brand-primary">{p.title}</span>
                      {p.published ? <Badge tone="green">Published</Badge> : <Badge tone="yellow">Draft</Badge>}
                      {p.published && p.showInFooter && <Badge tone="blue">In footer</Badge>}
                    </span>
                    <span className="block text-xs text-brand-gray mt-0.5">
                      <span className="font-mono">/p/{p.slug}</span> · updated {timeAgo(p.updatedAt)}
                    </span>
                  </button>
                  <div className="flex gap-1 flex-shrink-0">
                    {p.published && (
                      <a
                        href={`/p/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <EyeIcon className="w-4 h-4" /> View
                      </a>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                      <EditIcon className="w-4 h-4" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(p)} aria-label={`Delete ${p.title}`}>
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          )
        }
      </AsyncView>
      {deleteModal}
    </>
  );
};
