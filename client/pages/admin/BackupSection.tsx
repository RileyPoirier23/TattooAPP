// Admin → Backup: download a copy of the database and explain how backups work.
import React from 'react';
import { api } from '../../api';
import { useStore } from '../../store';
import { Button, Card, Notice, PageHeader, useApi } from '../../components/ui';
import { ClockIcon, DownloadIcon, LockIcon, PhotoIcon } from '../../components/Icons';
import { formatDateTime } from '../../lib/format';
import { AsyncView, LinkButton, useRunner } from './shared';

interface AutoBackup {
  name: string;
  size: number;
  createdAt: string;
}

const fileSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** The nightly copies the server keeps by itself (the newest seven). */
const AutomaticBackups: React.FC = () => {
  const state = useApi<AutoBackup[]>('/admin/backups');
  const { run, busy } = useRunner();
  const backupNow = () =>
    run(
      'now',
      async () => {
        state.setData(await api.post<AutoBackup[]>('/admin/backups'));
      },
      'Backup saved on the server.',
    );
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-bold text-brand-dark dark:text-white flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-brand-primary" /> Automatic backups
          </h2>
          <p className="text-sm text-brand-gray mt-0.5">
            The site saves a copy of its database every night and keeps the last 7. They&apos;re stored on the same server, so also download one now and then and keep it somewhere else.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={backupNow} loading={busy('now')}>
          Back up now
        </Button>
      </div>
      <AsyncView state={state}>
        {list =>
          list.length === 0 ? (
            <p className="text-sm text-brand-gray">No automatic backups yet. The first one is made within an hour of the site starting.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              {list.map(b => (
                <li key={b.name} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    {formatDateTime(b.createdAt)} <span className="text-brand-gray">· {fileSize(b.size)}</span>
                  </span>
                  <a href={`/api/admin/backups/${encodeURIComponent(b.name)}`} download className="inline-flex items-center gap-1 font-semibold text-brand-primary hover:underline">
                    <DownloadIcon className="w-4 h-4" /> Download
                  </a>
                </li>
              ))}
            </ul>
          )
        }
      </AsyncView>
    </Card>
  );
};

const Step: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) => (
  <li className="flex gap-3">
    <span className="w-6 h-6 rounded-full bg-brand-primary/15 text-brand-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{n}</span>
    <span>{children}</span>
  </li>
);

export const BackupSection: React.FC = () => {
  const siteName = useStore(s => s.config?.settings.siteName) || 'your site';
  return (
    <>
      <PageHeader title="Backup" subtitle="Keep a copy of your data somewhere safe, just in case." />
      <div className="space-y-6 max-w-3xl">
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <span className="w-14 h-14 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center flex-shrink-0">
              <DownloadIcon className="w-7 h-7" />
            </span>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-brand-dark dark:text-white">Download a backup</h2>
              <p className="text-sm text-brand-gray mt-0.5">
                One file with everything on {siteName}: accounts, profiles, shops, bookings, payments, payouts, messages, reviews, pages and settings.
              </p>
            </div>
            <LinkButton href="/api/admin/backup" download primary className="flex-shrink-0">
              <DownloadIcon className="w-4 h-4" /> Download backup
            </LinkButton>
          </div>
        </Card>

        <AutomaticBackups />

        <Card>
          <h2 className="text-lg font-bold text-brand-dark dark:text-white mb-3">Good habits</h2>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5">
            <li>Download a backup at least once a week, and always before updating the site or moving it to a new server.</li>
            <li>Store it somewhere other than your server: your computer plus a cloud drive is ideal.</li>
            <li>Keep a few older copies too, in case you need to go back further.</li>
          </ul>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-brand-dark dark:text-white mb-3 flex items-center gap-2">
            <PhotoIcon className="w-5 h-5 text-brand-primary" /> Photos are stored separately
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            The backup file doesn&apos;t include uploaded images (portfolios, avatars, shop photos, your logo). They live in the <span className="font-mono">uploads</span> folder
            inside the server&apos;s data directory. Copy that folder too, e.g. with your hosting provider&apos;s file manager or a disk snapshot.
          </p>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-brand-dark dark:text-white mb-3">Restoring a backup</h2>
          <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <Step n={1}>Stop the website.</Step>
            <Step n={2}>
              In the data directory, replace <span className="font-mono">inkspace.db</span> with your backup file (rename the backup to{' '}
              <span className="font-mono">inkspace.db</span>). Also delete any <span className="font-mono">inkspace.db-wal</span> and{' '}
              <span className="font-mono">inkspace.db-shm</span> files next to it.
            </Step>
            <Step n={3}>Copy your backed-up uploads folder back if needed, then start the website again.</Step>
          </ol>
          <p className="text-xs text-brand-gray mt-3">If your host set a custom database location (the DATABASE_FILE setting), replace that file instead. Not sure? Ask whoever set up your server.</p>
        </Card>

        <Notice tone="warning">
          <span className="flex gap-2">
            <LockIcon className="w-5 h-5 flex-shrink-0" />
            <span>
              Backups contain personal information (names, emails, messages) and your saved Square and email keys. Passwords are stored scrambled, but treat the file like
              something private: don&apos;t email it around or share it.
            </span>
          </span>
        </Notice>
      </div>
    </>
  );
};
