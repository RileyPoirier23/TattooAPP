// Loads the site settings and keeps an editable draft for one admin section.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useStore } from '../../store';
import { useApi } from '../../components/ui';
import type { SecretSettings, SiteSettings } from '../../../shared/types';
import type { SettingsResponse } from './types';

export function useSettingsDraft<K extends keyof SiteSettings>(keys: readonly K[]) {
  const state = useApi<SettingsResponse>('/admin/settings');
  const [draft, setDraft] = useState<SiteSettings | null>(null);
  const saved = state.data?.settings ?? null;

  useEffect(() => {
    if (saved && !draft) setDraft(saved);
  }, [saved, draft]);

  const dirty = !!draft && !!saved && keys.some(k => JSON.stringify(draft[k]) !== JSON.stringify(saved[k]));

  const set = useCallback(<F extends keyof SiteSettings>(key: F, value: SiteSettings[F]) => {
    setDraft(d => (d ? { ...d, [key]: value } : d));
  }, []);

  const discard = useCallback(() => {
    if (saved) setDraft(saved);
  }, [saved]);

  /** Saves this section's keys (plus any secrets) and refreshes the live site config. */
  const save = useCallback(
    async (secrets?: Partial<SecretSettings>) => {
      if (!draft) return null;
      const settings: Partial<SiteSettings> = {};
      for (const k of keys) (settings as Record<string, unknown>)[k] = draft[k];
      const body: Record<string, unknown> = { settings };
      if (secrets && Object.keys(secrets).length) body.secrets = secrets;
      const res = await api.put<SettingsResponse>('/admin/settings', body);
      state.setData(res);
      setDraft(res.settings);
      void useStore.getState().boot();
      return res;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, keys, state.setData],
  );

  /** Re-reads settings from the server (e.g. after a connection test changed the currency). */
  const refresh = useCallback(async () => {
    const res = await api.get<SettingsResponse>('/admin/settings');
    state.setData(res);
    setDraft(res.settings);
    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.setData]);

  return { state, draft, saved, secrets: state.data?.secrets ?? null, set, dirty, discard, save, refresh };
}
