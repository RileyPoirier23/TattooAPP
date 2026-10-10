// Admin → Settings: features, fees, lists, Square payments, email (SMTP) and Google Maps.
import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useStore } from '../../store';
import { Badge, Button, Field, Input, Notice, PageHeader, Select, Toggle, cx, inputClass } from '../../components/ui';
import {
  CheckIcon, CogIcon, CreditCardIcon, EyeIcon, LocationIcon, PaperAirplaneIcon, PlusIcon, PriceIcon, SparklesIcon, XIcon,
} from '../../components/Icons';
import type { SecretSettings, SiteFeatures } from '../../../shared/types';
import type { MaskedSecrets } from './types';
import { AsyncView, SaveBar, SettingsCard, useRunner, useUnsavedWarning } from './shared';
import { useSettingsDraft } from './useSettingsDraft';

const KEYS = [
  'features', 'depositFeePercent', 'boothFeePercent', 'proMonthlyPrice', 'defaultDeposit', 'currency', 'boothHoldHours',
  'bodyPlacements', 'specialties', 'squareApplicationId', 'squareLocationId', 'squareEnvironment', 'googleMapsApiKey',
] as const;

const FEATURES: { key: keyof SiteFeatures; label: string; description: string }[] = [
  { key: 'clientBooking', label: 'Client bookings', description: 'Clients can send booking requests to artists and pay a deposit online once the artist approves.' },
  { key: 'guestBooking', label: 'Book without an account', description: 'People can request a booking as a guest. They get a private link by email to check the request and pay.' },
  { key: 'boothRental', label: 'Booth rentals (guest spots)', description: 'Shops can list booths and travelling artists can rent them by the day.' },
  { key: 'messaging', label: 'Messaging', description: 'Members can send each other private messages.' },
  { key: 'proPlan', label: 'Pro plan', description: 'Artists can subscribe monthly. Their clients don’t pay the booking fee and they get a Pro badge.' },
  { key: 'reviews', label: 'Reviews', description: 'Clients can rate artists after an appointment, and artists can review shops they rented from.' },
  { key: 'unclaimedShops', label: 'Unclaimed shop listings', description: 'Show nearby tattoo shops from Google Maps that haven’t joined yet, so artists can find them. Needs a Google Maps key.' },
];

// ---------- Small inputs ----------

const NumberField: React.FC<{
  label: string;
  hint: React.ReactNode;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
  suffix?: string;
}> = ({ label, hint, value, onChange, min, max, step = 0.01, integer, suffix }) => {
  const error = !Number.isFinite(value)
    ? 'Enter a number.'
    : value < min || value > max
      ? `Must be between ${min} and ${max}.`
      : integer && !Number.isInteger(value)
        ? 'Use a whole number.'
        : undefined;
  return (
    <Field label={label} hint={hint} error={error}>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={integer ? 1 : step}
          value={Number.isFinite(value) ? value : ''}
          onChange={e => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
          className={cx(inputClass, suffix && 'pr-14')}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-brand-gray pointer-events-none">{suffix}</span>}
      </div>
    </Field>
  );
};

const numberProblem = (v: number, min: number, max: number, integer = false) =>
  !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v));

const ListEditor: React.FC<{ label: string; hint: string; values: string[]; onChange: (v: string[]) => void; max: number; placeholder: string }> = ({
  label, hint, values, onChange, max, placeholder,
}) => {
  const toast = useStore(s => s.toast);
  const [text, setText] = useState('');
  const add = () => {
    const items = text.split(',').map(s => s.trim().slice(0, 60)).filter(Boolean);
    if (!items.length) return;
    const next = [...values];
    for (const item of items) {
      if (next.some(v => v.toLowerCase() === item.toLowerCase())) continue;
      if (next.length >= max) {
        toast(`You can have up to ${max} items.`, 'error');
        break;
      }
      next.push(item);
    }
    onChange(next);
    setText('');
  };
  return (
    <Field label={label} hint={hint}>
      <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-3">
        {values.length === 0 ? (
          <p className="text-sm text-brand-gray mb-3">Nothing here yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-3">
            {values.map(v => (
              <span key={v} className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 text-brand-primary text-sm font-medium pl-3 pr-1 py-1">
                {v}
                <button
                  type="button"
                  onClick={() => onChange(values.filter(x => x !== v))}
                  aria-label={`Remove ${v}`}
                  className="rounded-full p-0.5 hover:bg-brand-primary/20"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={text}
            maxLength={200}
            placeholder={placeholder}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            className={cx(inputClass, 'py-2')}
          />
          <Button variant="outline" onClick={add} disabled={!text.trim()}>
            <PlusIcon className="w-4 h-4" /> Add
          </Button>
        </div>
      </div>
    </Field>
  );
};

/** Write-only secret: never shows the saved value, only whether one exists. */
const SecretField: React.FC<{
  label: string;
  isSet: boolean;
  value: string;
  onChange: (v: string) => void;
  cleared: boolean;
  onClear: (v: boolean) => void;
  hint?: React.ReactNode;
  disabled?: boolean;
}> = ({ label, isSet, value, onChange, cleared, onClear, hint, disabled }) => {
  const [show, setShow] = useState(false);
  return (
    <Field
      label={
        <span className="flex flex-wrap items-center gap-2">
          {label}
          {isSet && !cleared && !value && (
            <Badge tone="green">
              <CheckIcon className="w-3 h-3" /> Saved
            </Badge>
          )}
          {isSet && value && <Badge tone="yellow">Will be replaced</Badge>}
          {cleared && !value && <Badge tone="red">Will be removed</Badge>}
        </span>
      }
      hint={hint}
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            spellCheck={false}
            disabled={disabled}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={isSet && !cleared ? '•••••••• (leave blank to keep the saved one)' : 'Paste it here'}
            className={cx(inputClass, 'pr-10 font-mono text-sm')}
          />
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            aria-label={show ? 'Hide' : 'Show'}
            className={cx('absolute right-3 top-1/2 -translate-y-1/2', show ? 'text-brand-primary' : 'text-brand-gray hover:text-brand-dark dark:hover:text-white')}
          >
            <EyeIcon className="w-4 h-4" />
          </button>
        </div>
        {isSet && !disabled && (
          <Button variant="ghost" onClick={() => onClear(!cleared)}>
            {cleared ? 'Keep' : 'Remove'}
          </Button>
        )}
      </div>
    </Field>
  );
};

const StatusPill: React.FC<{ ready: boolean; readyLabel?: string; notLabel?: string }> = ({ ready, readyLabel = 'Ready', notLabel = 'Not set up' }) =>
  ready ? (
    <Badge tone="green">
      <CheckIcon className="w-3 h-3" /> {readyLabel}
    </Badge>
  ) : (
    <Badge tone="yellow">{notLabel}</Badge>
  );

// ---------- Secrets draft ----------

interface SecretDraft {
  squareAccessToken: string;
  clearSquareToken: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  clearSmtpPass: boolean;
  smtpFrom: string;
  resendApiKey: string;
  clearResendKey: boolean;
}

const fromMasked = (m: MaskedSecrets): SecretDraft => ({
  squareAccessToken: '',
  clearSquareToken: false,
  smtpHost: m.smtpHost,
  smtpPort: m.smtpPort,
  smtpSecure: m.smtpSecure,
  smtpUser: m.smtpUser,
  smtpPass: '',
  clearSmtpPass: false,
  smtpFrom: m.smtpFrom,
  resendApiKey: '',
  clearResendKey: false,
});

/** Only the secret fields the admin actually changed. */
function secretsPatch(d: SecretDraft, m: MaskedSecrets): Partial<SecretSettings> {
  const p: Partial<SecretSettings> = {};
  if (d.squareAccessToken.trim()) p.squareAccessToken = d.squareAccessToken.trim();
  else if (d.clearSquareToken) p.squareAccessToken = '';
  if (d.smtpHost.trim() !== m.smtpHost) p.smtpHost = d.smtpHost.trim();
  if (d.smtpPort !== m.smtpPort) p.smtpPort = d.smtpPort;
  if (d.smtpSecure !== m.smtpSecure) p.smtpSecure = d.smtpSecure;
  if (d.smtpUser.trim() !== m.smtpUser) p.smtpUser = d.smtpUser.trim();
  if (d.smtpPass) p.smtpPass = d.smtpPass;
  else if (d.clearSmtpPass) p.smtpPass = '';
  if (d.smtpFrom.trim() !== m.smtpFrom) p.smtpFrom = d.smtpFrom.trim();
  if (d.resendApiKey.trim()) p.resendApiKey = d.resendApiKey.trim();
  else if (d.clearResendKey) p.resendApiKey = '';
  return p;
}

const SMTP_PRESETS: { name: string; host: string; port: number; secure: boolean; user?: string }[] = [
  { name: 'Gmail', host: 'smtp.gmail.com', port: 587, secure: false },
  { name: 'Resend', host: 'smtp.resend.com', port: 465, secure: true, user: 'resend' },
  { name: 'Brevo', host: 'smtp-relay.brevo.com', port: 587, secure: false },
];

// ---------- Section ----------

export const SettingsSection: React.FC = () => {
  const { state, draft, saved, secrets, set, dirty: settingsDirty, discard, save, refresh } = useSettingsDraft(KEYS);
  const adminEmail = useStore(s => s.user?.email) || '';
  const { run, busy, anyBusy } = useRunner();
  const [sd, setSd] = useState<SecretDraft | null>(null);
  const [testTo, setTestTo] = useState(adminEmail);
  const [squareResult, setSquareResult] = useState<string | null>(null);

  useEffect(() => {
    if (secrets && !sd) setSd(fromMasked(secrets));
  }, [secrets, sd]);

  const patch = sd && secrets ? secretsPatch(sd, secrets) : {};
  const dirty = settingsDirty || Object.keys(patch).length > 0;
  useUnsavedWarning(dirty);

  const updateSecret = <K extends keyof SecretDraft>(k: K, v: SecretDraft[K]) => setSd(prev => (prev ? { ...prev, [k]: v } : prev));
  const setFeature = (k: keyof SiteFeatures, v: boolean) => draft && set('features', { ...draft.features, [k]: v });

  const problem = !draft || !sd
    ? null
    : numberProblem(draft.depositFeePercent, 0, 50) ||
        numberProblem(draft.boothFeePercent, 0, 50) ||
        numberProblem(draft.proMonthlyPrice, 0, 10000) ||
        numberProblem(draft.defaultDeposit, 0, 100000) ||
        numberProblem(draft.boothHoldHours, 1, 720, true)
      ? 'Check the highlighted numbers.'
      : !/^[A-Z]{3}$/.test(draft.currency)
        ? 'The currency must be a 3-letter code like USD.'
        : numberProblem(sd.smtpPort, 1, 65535, true)
          ? 'The email port must be a number like 587.'
          : null;

  const doSave = async () => {
    const res = await save(patch);
    if (res) setSd(fromMasked(res.secrets));
  };
  const onSave = () => run('save', doSave, 'Settings saved.');
  const onDiscard = () => {
    discard();
    if (secrets) setSd(fromMasked(secrets));
  };

  const testSquare = () =>
    run(
      'square',
      async () => {
        setSquareResult(null);
        if (dirty) await doSave();
        const r = await api.post<{ ok: boolean; currency: string }>('/admin/square-check');
        setSquareResult(r.currency);
        const fresh = await refresh();
        setSd(fromMasked(fresh.secrets));
      },
      'Square is connected!',
    );

  const testEmail = () =>
    run(
      'email',
      async () => {
        if (dirty) await doSave();
        await api.post('/admin/test-email', { to: testTo.trim() });
      },
      `Test email sent to ${testTo.trim()}. Check your inbox (and spam folder).`,
    );

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Turn features on or off, set your fees, and connect payments and email."
        actions={
          <Button onClick={onSave} loading={busy('save')} disabled={!dirty || !!problem || anyBusy}>
            Save changes
          </Button>
        }
      />
      <AsyncView state={state}>
        {() => {
          if (!draft || !sd || !secrets || !saved) return null;
          const squareReady = secrets.squareAccessTokenSet && !!saved.squareApplicationId && !!saved.squareLocationId;
          const emailReady = secrets.smtpFromEnv || secrets.resendFromEnv || secrets.resendApiKeySet || !!secrets.smtpHost;
          const squareEnvDisabled = secrets.squareAccessTokenFromEnv;
          return (
            <div className="space-y-6">
              {/* Features */}
              <SettingsCard title="Features" description="Turn parts of the site on or off. Changes apply as soon as you save." icon={<SparklesIcon className="w-5 h-5" />}>
                <div className="divide-y divide-gray-100 dark:divide-gray-800 -my-2">
                  {FEATURES.map(f => {
                    const needsBooking = f.key === 'guestBooking' && !draft.features.clientBooking;
                    const needsMaps = f.key === 'unclaimedShops' && !draft.googleMapsApiKey.trim();
                    return (
                      <div key={f.key} className="py-4">
                        <Toggle
                          checked={draft.features[f.key]}
                          onChange={v => setFeature(f.key, v)}
                          disabled={needsBooking}
                          label={f.label}
                          description={
                            <>
                              {f.description}
                              {needsBooking && <span className="block text-amber-600 dark:text-amber-400">Turn on Client bookings first.</span>}
                              {needsMaps && draft.features.unclaimedShops && (
                                <span className="block text-amber-600 dark:text-amber-400">Add a Google Maps key below for this to work.</span>
                              )}
                            </>
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </SettingsCard>

              {/* Fees */}
              <SettingsCard title="Fees & pricing" description="How the site makes money, and a few booking rules." icon={<PriceIcon className="w-5 h-5" />}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <NumberField
                    label="Booking fee"
                    suffix="%"
                    min={0}
                    max={50}
                    value={draft.depositFeePercent}
                    onChange={v => set('depositFeePercent', v)}
                    hint="Added on top of the deposit and paid by the client. This is your income from bookings. Not charged when the artist has Pro."
                  />
                  <NumberField
                    label="Booth rental commission"
                    suffix="%"
                    min={0}
                    max={50}
                    value={draft.boothFeePercent}
                    onChange={v => set('boothFeePercent', v)}
                    hint="Your cut of every booth rental. The rest is owed to the shop."
                  />
                  <NumberField
                    label="Pro plan price (per month)"
                    suffix={draft.currency}
                    min={0}
                    max={10000}
                    value={draft.proMonthlyPrice}
                    onChange={v => set('proMonthlyPrice', v)}
                    hint="What artists pay each month for Pro."
                  />
                  <NumberField
                    label="Default deposit"
                    suffix={draft.currency}
                    min={0}
                    max={100000}
                    value={draft.defaultDeposit}
                    onChange={v => set('defaultDeposit', v)}
                    hint="Used when a client books without choosing one of the artist's services."
                  />
                  <Input
                    label="Currency"
                    value={draft.currency}
                    maxLength={3}
                    onChange={e => set('currency', e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                    error={/^[A-Z]{3}$/.test(draft.currency) ? undefined : 'Use a 3-letter code like USD, CAD, GBP, EUR or AUD.'}
                    hint="Must match your Square account. “Test connection” below sets it for you."
                  />
                  <NumberField
                    label="Hold unpaid booth reservations for"
                    suffix="hours"
                    integer
                    min={1}
                    max={720}
                    value={draft.boothHoldHours}
                    onChange={v => set('boothHoldHours', v)}
                    hint="If the artist doesn't pay in time, the booth is released for others."
                  />
                </div>
              </SettingsCard>

              {/* Lists */}
              <SettingsCard title="Choices on forms" description="The options people pick from when booking and building profiles." icon={<CogIcon className="w-5 h-5" />}>
                <ListEditor
                  label="Body placements"
                  hint="Clients pick one when requesting a tattoo. Removing an option doesn't change existing bookings."
                  values={draft.bodyPlacements}
                  onChange={v => set('bodyPlacements', v)}
                  max={60}
                  placeholder="e.g. Ankle (press Enter to add)"
                />
                <ListEditor
                  label="Tattoo styles"
                  hint="Artists pick their specialty from this list, and clients can search by it."
                  values={draft.specialties}
                  onChange={v => set('specialties', v)}
                  max={100}
                  placeholder="e.g. Dotwork (press Enter to add)"
                />
              </SettingsCard>

              {/* Square */}
              <SettingsCard
                title="Square payments"
                description="Deposits, booth rentals and Pro subscriptions are paid by card through your Square account."
                icon={<CreditCardIcon className="w-5 h-5" />}
                aside={<StatusPill ready={squareReady} readyLabel="Connected" />}
              >
                <Notice>
                  <p className="font-semibold mb-1">Where to find your keys</p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>
                      Sign in at{' '}
                      <a href="https://developer.squareup.com/apps" target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                        developer.squareup.com
                      </a>{' '}
                      with your Square account.
                    </li>
                    <li>Open <strong>Applications</strong> and choose your app (or click “+” to create one, any name is fine).</li>
                    <li>Pick <strong>Sandbox</strong> or <strong>Production</strong> at the top of the page. Start with Sandbox to test with fake cards.</li>
                    <li>
                      Under <strong>Credentials</strong>, copy the <strong>Application ID</strong> and the <strong>Access token</strong>.
                    </li>
                    <li>
                      Under <strong>Locations</strong>, copy the <strong>Location ID</strong>.
                    </li>
                    <li>Paste them below, pick the same environment, then click <strong>Test connection</strong>.</li>
                  </ol>
                  <p className="mt-2">All three must come from the same environment. When you&apos;re ready for real payments, switch to your Production keys.</p>
                </Notice>
                {secrets.squareConfigFromEnv && (
                  <Notice tone="warning">
                    Some Square settings are set by your hosting provider&apos;s environment variables (SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID or SQUARE_ENVIRONMENT). Those values win over anything saved here — change them in your host&apos;s settings instead.
                  </Notice>
                )}
                <Select
                  label="Environment"
                  value={draft.squareEnvironment}
                  onChange={e => set('squareEnvironment', e.target.value === 'production' ? 'production' : 'sandbox')}
                  className="sm:max-w-sm"
                >
                  <option value="sandbox">Sandbox (testing, no real money)</option>
                  <option value="production">Production (real payments)</option>
                </Select>
                {draft.squareEnvironment === 'sandbox' ? (
                  <p className="text-sm text-brand-gray -mt-2">
                    Test mode: pay with Square&apos;s test card <span className="font-mono">4111 1111 1111 1111</span>, any future expiry date and CVV <span className="font-mono">111</span>.
                  </p>
                ) : (
                  <p className="text-sm text-amber-600 dark:text-amber-400 -mt-2">Live mode: real cards will be charged.</p>
                )}
                <div className="grid gap-5 sm:grid-cols-2">
                  <Input
                    label="Application ID"
                    value={draft.squareApplicationId}
                    maxLength={200}
                    spellCheck={false}
                    placeholder={draft.squareEnvironment === 'sandbox' ? 'sandbox-sq0idb-…' : 'sq0idp-…'}
                    onChange={e => set('squareApplicationId', e.target.value.trim())}
                    className="[&_input]:font-mono [&_input]:text-sm"
                  />
                  <Input
                    label="Location ID"
                    value={draft.squareLocationId}
                    maxLength={200}
                    spellCheck={false}
                    placeholder="L…"
                    onChange={e => set('squareLocationId', e.target.value.trim())}
                    className="[&_input]:font-mono [&_input]:text-sm"
                  />
                </div>
                <SecretField
                  label="Access token"
                  isSet={secrets.squareAccessTokenSet}
                  value={sd.squareAccessToken}
                  onChange={v => updateSecret('squareAccessToken', v)}
                  cleared={sd.clearSquareToken}
                  onClear={v => updateSecret('clearSquareToken', v)}
                  disabled={squareEnvDisabled}
                  hint={
                    squareEnvDisabled
                      ? 'Set on the server with the SQUARE_ACCESS_TOKEN environment variable, which overrides this field.'
                      : 'Kept secret: it is never shown again after saving. Treat it like a password.'
                  }
                />
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                  <Button variant="outline" onClick={testSquare} loading={busy('square')} disabled={!!problem || (anyBusy && !busy('square'))}>
                    {dirty ? 'Save & test connection' : 'Test connection'}
                  </Button>
                  {squareResult && (
                    <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                      <CheckIcon className="w-4 h-4" /> Connected. Your Square location uses {squareResult}
                      {squareResult === draft.currency ? ', and the site currency matches.' : '.'}
                    </span>
                  )}
                </div>
              </SettingsCard>

              {/* Email */}
              <SettingsCard
                title="Email"
                description="Used for booking updates, receipts and password resets."
                icon={<PaperAirplaneIcon className="w-5 h-5" />}
                aside={<StatusPill ready={emailReady} />}
              >
                {secrets.smtpFromEnv && (
                  <Notice tone="warning">Email is configured on the server with the SMTP_URL environment variable. It overrides the fields below.</Notice>
                )}
                <div className="rounded-xl border border-brand-primary/30 bg-brand-primary/5 p-4 space-y-3">
                  <p className="text-sm">
                    <strong>Recommended: Resend.</strong> Create a free account at{' '}
                    <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold">resend.com</a>, verify your domain, create an API key and paste it here.
                    It works on every host — including Railway's Hobby plan, which blocks the SMTP option below.
                  </p>
                  {secrets.resendFromEnv ? (
                    <p className="text-sm text-brand-gray">A Resend key is set on the server (RESEND_API_KEY) and is used for all email.</p>
                  ) : (
                    <SecretField
                      label="Resend API key"
                      isSet={!!secrets.resendApiKeySet}
                      value={sd.resendApiKey}
                      onChange={v => updateSecret('resendApiKey', v)}
                      cleared={sd.clearResendKey}
                      onClear={v => updateSecret('clearResendKey', v)}
                    />
                  )}
                  <p className="text-xs text-brand-gray">When a Resend key is set, the SMTP settings below are ignored. Fill in the From address below with an address on your verified domain.</p>
                </div>
                <Notice>
                  <p className="font-semibold mb-1">Which email service?</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>
                      <strong>Gmail:</strong> host smtp.gmail.com, port 587, your Gmail address as username, and an{' '}
                      <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                        App Password
                      </a>{' '}
                      (needs 2-Step Verification). Not your normal password. Good for low volume.
                    </li>
                    <li>
                      <strong>Resend over SMTP</strong>: host smtp.resend.com, port 465 with SSL on, username <span className="font-mono">resend</span>, password = your API key. (Prefer the API key box above.)
                    </li>
                    <li>
                      <strong>Brevo</strong> (brevo.com): host smtp-relay.brevo.com, port 587, your Brevo login and SMTP key (Settings → SMTP & API).
                    </li>
                  </ul>
                </Notice>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-brand-gray">Fill in for:</span>
                  {SMTP_PRESETS.map(p => (
                    <Button
                      key={p.name}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setSd(prev =>
                          prev ? { ...prev, smtpHost: p.host, smtpPort: p.port, smtpSecure: p.secure, smtpUser: p.user ?? prev.smtpUser } : prev,
                        )
                      }
                    >
                      {p.name}
                    </Button>
                  ))}
                </div>
                <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_9rem]">
                  <Input label="SMTP host" value={sd.smtpHost} maxLength={200} spellCheck={false} placeholder="smtp.example.com" onChange={e => updateSecret('smtpHost', e.target.value)} />
                  <NumberField label="Port" hint="Usually 587 or 465." integer min={1} max={65535} value={sd.smtpPort} onChange={v => updateSecret('smtpPort', v)} />
                </div>
                <Toggle
                  checked={sd.smtpSecure}
                  onChange={v => updateSecret('smtpSecure', v)}
                  label="Use SSL/TLS"
                  description="Turn on for port 465. Leave off for port 587 (it upgrades to a secure connection automatically)."
                />
                <div className="grid gap-5 sm:grid-cols-2">
                  <Input label="Username" value={sd.smtpUser} maxLength={200} spellCheck={false} autoComplete="off" onChange={e => updateSecret('smtpUser', e.target.value)} />
                  <SecretField
                    label="Password"
                    isSet={!!secrets.smtpPassSet}
                    value={sd.smtpPass}
                    onChange={v => updateSecret('smtpPass', v)}
                    cleared={sd.clearSmtpPass}
                    onClear={v => updateSecret('clearSmtpPass', v)}
                  />
                </div>
                <Input
                  label="From address"
                  value={sd.smtpFrom}
                  maxLength={200}
                  placeholder={`${draft.siteName} <bookings@yourdomain.com>`}
                  onChange={e => updateSecret('smtpFrom', e.target.value)}
                  hint="Who emails appear to come from, e.g. bookings@yourdomain.com. Leave blank to use the username. Many services only allow addresses you've verified with them."
                />
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                  <p className="text-sm font-semibold text-brand-dark dark:text-white mb-2">Send a test email</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      value={testTo}
                      onChange={e => setTestTo(e.target.value)}
                      placeholder="you@example.com"
                      aria-label="Send the test email to"
                      className={cx(inputClass, 'sm:max-w-xs')}
                    />
                    <Button
                      variant="outline"
                      onClick={testEmail}
                      loading={busy('email')}
                      disabled={!testTo.trim() || !!problem || (anyBusy && !busy('email')) || (!emailReady && !sd.smtpHost.trim() && !sd.resendApiKey.trim())}
                    >
                      <PaperAirplaneIcon className="w-4 h-4" />
                      {dirty ? 'Save & send test' : 'Send test'}
                    </Button>
                  </div>
                </div>
              </SettingsCard>

              {/* Maps */}
              <SettingsCard
                title="Google Maps (optional)"
                description="Turns addresses into map locations, powers “near me” search and finds shops that haven't joined yet."
                icon={<LocationIcon className="w-5 h-5" />}
                aside={<StatusPill ready={!!saved.googleMapsApiKey} readyLabel="On" notLabel="Off" />}
              >
                <Input
                  label="Google Maps API key"
                  value={draft.googleMapsApiKey}
                  maxLength={200}
                  spellCheck={false}
                  placeholder="AIza…"
                  onChange={e => set('googleMapsApiKey', e.target.value.trim())}
                  className="[&_input]:font-mono [&_input]:text-sm"
                  hint={
                    <>
                      In the{' '}
                      <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline">
                        Google Cloud Console
                      </a>
                      , create a project, enable the <strong>Maps JavaScript API</strong>, <strong>Places API</strong> and <strong>Geocoding API</strong>, then create an API key
                      under APIs &amp; Services → Credentials. Restrict it to your website&apos;s address. This key is visible to visitors&apos; browsers, which is normal.
                    </>
                  }
                />
              </SettingsCard>

              <SaveBar dirty={dirty} saving={busy('save')} canSave={!problem && !anyBusy} problem={problem} onSave={onSave} onDiscard={onDiscard} />
            </div>
          );
        }}
      </AsyncView>
    </>
  );
};
