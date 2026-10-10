// Admin → Users: search, edit roles/status/plan, reset passwords, delete accounts.
import React, { useCallback, useMemo, useState } from 'react';
import { api } from '../../api';
import { useLocation } from '../../router';
import { useStore } from '../../store';
import { Avatar, Badge, Button, Card, EmptyState, Input, PageHeader, Select, StatusBadge, Toggle, useApi } from '../../components/ui';
import { CheckBadgeIcon, EditIcon, LinkIcon, LockIcon, TrashIcon, UsersIcon } from '../../components/Icons';
import { ROLE_LABELS, formatDate, toDateStr } from '../../lib/format';
import type { Role } from '../../../shared/types';
import { PAYOUT_TYPE_LABELS, type AdminUser } from './types';
import { AsyncView, ConfirmModal, DataTable, Dialog, Muted, SearchInput, Td, Toolbar, copyText, useDebounced, useRunner } from './shared';

const ROLE_TONES: Record<Role, 'gray' | 'brand' | 'purple' | 'blue' | 'red'> = {
  client: 'gray',
  artist: 'brand',
  dual: 'purple',
  'shop-owner': 'blue',
  admin: 'red',
};

const isProActive = (u: AdminUser) => u.subscriptionTier === 'pro' && (!u.proUntil || new Date(u.proUntil) > new Date());

const PlanCell: React.FC<{ u: AdminUser }> = ({ u }) => {
  if (u.subscriptionTier !== 'pro') return <span className="text-brand-gray">Free</span>;
  const active = isProActive(u);
  return (
    <>
      <Badge tone={active ? 'brand' : 'gray'}>{active ? 'Pro' : 'Pro (expired)'}</Badge>
      <Muted className="mt-1">{u.proUntil ? `${active ? 'until' : 'ended'} ${formatDate(u.proUntil, { month: 'short', day: 'numeric', year: 'numeric' })}` : 'no end date'}</Muted>
    </>
  );
};

interface Form {
  name: string;
  email: string;
  role: Role;
  status: 'active' | 'suspended';
  isVerified: boolean;
  subscriptionTier: 'free' | 'pro';
  proUntil: string;
  password: string;
}

const EditUserModal: React.FC<{ user: AdminUser; isSelf: boolean; onClose: () => void; onSaved: (u: AdminUser) => void; onDelete: () => void }> = ({
  user, isSelf, onClose, onSaved, onDelete,
}) => {
  const initial = useMemo<Form>(
    () => ({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      isVerified: user.isVerified,
      subscriptionTier: user.subscriptionTier,
      proUntil: user.proUntil ? toDateStr(new Date(user.proUntil)) : '',
      password: '',
    }),
    [user],
  );
  const [f, setF] = useState<Form>(initial);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const { run, busy } = useRunner();
  const toast = useStore(s => s.toast);
  const update = <K extends keyof Form>(k: K, v: Form[K]) => setF(prev => ({ ...prev, [k]: v }));

  const body: Record<string, unknown> = {};
  if (f.name.trim() !== initial.name) body.name = f.name.trim();
  if (f.email.trim().toLowerCase() !== initial.email) body.email = f.email.trim().toLowerCase();
  if (f.role !== initial.role) body.role = f.role;
  if (f.status !== initial.status) body.status = f.status;
  if (f.isVerified !== initial.isVerified) body.isVerified = f.isVerified;
  if (f.subscriptionTier !== initial.subscriptionTier) body.subscriptionTier = f.subscriptionTier;
  if (f.subscriptionTier === 'pro' && f.proUntil !== initial.proUntil) body.proUntil = f.proUntil || null;
  if (f.password) body.password = f.password;
  const changed = Object.keys(body).length > 0;

  const nameError = f.name.trim() ? undefined : 'Required';
  const emailError = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()) ? undefined : 'Enter a valid email.';
  const passwordError = f.password && f.password.length < 8 ? 'At least 8 characters.' : undefined;

  const save = () =>
    run(
      'save',
      async () => {
        const updated = await api.patch<AdminUser>(`/admin/users/${user.id}`, body);
        onSaved(updated);
        onClose();
      },
      `${f.name.trim()} was updated.`,
    );

  const getResetLink = () =>
    run('reset', async () => {
      const { link } = await api.post<{ link: string }>(`/admin/users/${user.id}/reset-link`);
      setResetLink(link);
      const ok = await copyText(link);
      toast(ok ? 'Reset link copied. Send it to them; it works for 72 hours.' : 'Reset link created. Copy it below.', 'success');
    });

  const payout = user.payoutMethod;

  return (
    <Dialog
      title={`Edit ${user.name}`}
      onClose={onClose}
      closeDisabled={busy('save')}
      size="lg"
      footer={
        <>
          {!isSelf && (
            <Button variant="ghost" className="mr-auto text-red-600 dark:text-red-400" onClick={onDelete} disabled={busy('save')}>
              <TrashIcon className="w-4 h-4" /> Delete account
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={busy('save')}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy('save')} disabled={!changed || !!nameError || !!emailError || !!passwordError}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {isSelf && (
          <p className="text-sm rounded-lg bg-brand-primary/10 text-brand-primary px-3 py-2">
            This is your own account. You can&apos;t change your own role or suspend yourself.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" value={f.name} maxLength={100} onChange={e => update('name', e.target.value)} error={nameError} />
          <Input label="Email" type="email" value={f.email} maxLength={200} onChange={e => update('email', e.target.value)} error={emailError} />
          <Select label="Role" value={f.role} disabled={isSelf} onChange={e => update('role', e.target.value as Role)} hint="Artist + client accounts can do both.">
            {Object.entries(ROLE_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Account status"
            value={f.status}
            disabled={isSelf}
            onChange={e => update('status', e.target.value === 'suspended' ? 'suspended' : 'active')}
            hint={f.status === 'suspended' ? 'They are logged out and can’t log in.' : 'Can log in normally.'}
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </Select>
        </div>

        <Toggle
          checked={f.isVerified}
          onChange={v => update('isVerified', v)}
          label="Verified"
          description="Shows a verified badge on their profile. They get a notification when you turn this on."
        />

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Plan" value={f.subscriptionTier} onChange={e => update('subscriptionTier', e.target.value === 'pro' ? 'pro' : 'free')}>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
            </Select>
            {f.subscriptionTier === 'pro' && (
              <Input
                label="Pro until"
                type="date"
                value={f.proUntil}
                onChange={e => update('proUntil', e.target.value)}
                hint="Leave empty for no end date."
              />
            )}
          </div>
          <p className="text-xs text-brand-gray">
            {user.proAutoRenew
              ? 'This person pays for Pro with their card and it renews automatically.'
              : 'Giving someone Pro here is free for them. Nothing is charged.'}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-4">
          <p className="font-semibold text-brand-dark dark:text-white flex items-center gap-2">
            <LockIcon className="w-4 h-4" /> Password
          </p>
          <Input
            label="Set a new password"
            type="password"
            autoComplete="new-password"
            value={f.password}
            onChange={e => update('password', e.target.value)}
            error={passwordError}
            hint="Leave blank to keep their current password. Setting one logs them out everywhere."
          />
          <div>
            <Button variant="outline" size="sm" onClick={getResetLink} loading={busy('reset')}>
              <LinkIcon className="w-4 h-4" /> Copy password reset link
            </Button>
            <p className="text-xs text-brand-gray mt-1">Better than setting a password: send them this link so they can choose their own.</p>
            {resetLink && (
              <input
                readOnly
                value={resetLink}
                onFocus={e => e.target.select()}
                aria-label="Password reset link"
                className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs font-mono text-brand-dark dark:text-white"
              />
            )}
          </div>
        </div>

        {(user.role === 'artist' || user.role === 'dual' || user.role === 'shop-owner') && (
          <div className="text-sm">
            <p className="font-semibold text-brand-dark dark:text-white">Payout details</p>
            {payout.type || payout.details ? (
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                {payout.type && <strong>{PAYOUT_TYPE_LABELS[payout.type] ?? payout.type}: </strong>}
                {payout.details}
              </p>
            ) : (
              <p className="text-brand-gray">Not added yet.</p>
            )}
          </div>
        )}
        <p className="text-xs text-brand-gray">
          Joined {formatDate(user.createdAt)}
          {user.city && ` · ${user.city}`}
          {user.reviewCount > 0 && ` · ${user.averageRating.toFixed(1)}★ from ${user.reviewCount} review${user.reviewCount === 1 ? '' : 's'}`}
        </p>
      </div>
    </Dialog>
  );
};

export const UsersSection: React.FC = () => {
  const { query } = useLocation();
  const me = useStore(s => s.user);
  const [q, setQ] = useState(() => query.get('q') ?? '');
  const [role, setRole] = useState('');
  const dq = useDebounced(q.trim(), 300);
  const state = useApi<AdminUser[]>(`/admin/users?q=${encodeURIComponent(dq)}&role=${encodeURIComponent(role)}`);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const { run } = useRunner();

  const closeEdit = useCallback(() => setEditing(null), []);
  const closeDelete = useCallback(() => setDeleting(null), []);
  const onSaved = useCallback(
    (u: AdminUser) => state.setData(list => (list ?? []).map(x => (x.id === u.id ? u : x))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.setData],
  );

  const confirmDelete = (u: AdminUser) =>
    run(
      'delete',
      async () => {
        await api.del(`/admin/users/${u.id}`);
        state.setData(list => (list ?? []).filter(x => x.id !== u.id));
      },
      `${u.name}'s account was deleted.`,
    );

  return (
    <>
      <PageHeader title="Users" subtitle="Everyone with an account: clients, artists, shop owners and admins." />
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search by name, email or city" loading={dq !== q.trim()} className="flex-1" />
        <Select value={role} onChange={e => setRole(e.target.value)} aria-label="Filter by role" className="sm:w-52">
          <option value="">All roles</option>
          {Object.entries(ROLE_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
      </Toolbar>
      <AsyncView state={state}>
        {users =>
          users.length === 0 ? (
            <Card>
              <EmptyState icon={<UsersIcon className="w-12 h-12" />} title={dq || role ? 'No matches' : 'No users yet'}>
                {dq || role ? 'Try a different search or role.' : 'People who sign up will appear here.'}
              </EmptyState>
            </Card>
          ) : (
            <Card padded={false} className="overflow-hidden">
              <DataTable columns={['Person', 'Role', 'Status', 'Plan', 'Joined', '']}>
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <Td>
                      <button type="button" onClick={() => setEditing(u)} className="flex items-center gap-3 text-left group min-w-[14rem]">
                        <Avatar name={u.name} size="sm" />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1 font-semibold group-hover:text-brand-primary">
                            {u.name}
                            {u.isVerified && <CheckBadgeIcon className="w-4 h-4 text-sky-500" title="Verified" />}
                            {u.id === me?.id && <Badge tone="brand" className="ml-1">You</Badge>}
                          </span>
                          <Muted>{u.email}</Muted>
                          {u.city && <Muted>{u.city}</Muted>}
                        </span>
                      </button>
                    </Td>
                    <Td>
                      <Badge tone={ROLE_TONES[u.role] ?? 'gray'}>{ROLE_LABELS[u.role] ?? u.role}</Badge>
                    </Td>
                    <Td>
                      <StatusBadge status={u.status} />
                    </Td>
                    <Td className="whitespace-nowrap">
                      <PlanCell u={u} />
                    </Td>
                    <Td className="whitespace-nowrap text-brand-gray">{formatDate(u.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}</Td>
                    <Td className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
                        <EditIcon className="w-4 h-4" /> Edit
                      </Button>
                    </Td>
                  </tr>
                ))}
              </DataTable>
              <p className="px-4 py-3 text-xs text-brand-gray border-t border-gray-100 dark:border-gray-800">
                {users.length === 500 ? 'Showing the 500 newest matches. Search to narrow it down.' : `${users.length} ${users.length === 1 ? 'person' : 'people'}`}
              </p>
            </Card>
          )
        }
      </AsyncView>

      {editing && (
        <EditUserModal
          user={editing}
          isSelf={editing.id === me?.id}
          onClose={closeEdit}
          onSaved={onSaved}
          onDelete={() => {
            setDeleting(editing);
            setEditing(null);
          }}
        />
      )}
      {deleting && (
        <ConfirmModal title="Delete this account?" confirmLabel="Delete account" onClose={closeDelete} onConfirm={() => confirmDelete(deleting)}>
          <p>
            <strong>{deleting.name}</strong> ({deleting.email}) will be permanently deleted, along with everything they own: their profile, shop, bookings as an artist, reviews, messages and payout records. Payment records are kept. This can&apos;t be undone.
          </p>
          <p>If you just want to stop them from logging in, suspend the account instead.</p>
        </ConfirmModal>
      )}
    </>
  );
};
