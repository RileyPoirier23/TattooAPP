// Three-step booking request: service & date → tattoo details → contact & send.
import React, { useMemo, useState } from 'react';
import { api, errorMessage } from '../api';
import { prepareImages } from '../lib/images';
import { useUnsavedWarning } from '../lib/unsaved';
import { useStore } from '../store';
import { navigate } from '../router';
import { currencySymbol, dollars, formatDate, parseDate, PREFERRED_TIMES } from '../lib/format';
import { Calendar } from './Calendar';
import { Button, Input, Modal, Notice, Select, Textarea, cx } from './ui';
import { CheckIcon, PhotoIcon, XIcon } from './Icons';
import type { ArtistDetail, BookingRequest, PreferredTime } from '../../shared/types';

export const BookingRequestModal: React.FC<{ artist: ArtistDetail; onClose: () => void }> = ({ artist, onClose }) => {
  const user = useStore(s => s.user);
  const settings = useStore(s => s.config!.settings);
  const emailReady = useStore(s => s.config!.emailReady);
  const policyPage = useStore(s => s.config!.pages.find(p => p.slug === 'booking-policy'));
  const toast = useStore(s => s.toast);
  const [accepted, setAccepted] = useState(false);
  const intake = artist.intakeSettings;
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState(artist.services[0]?.id || '');
  const [date, setDate] = useState('');
  const [preferredTime, setPreferredTime] = useState<PreferredTime>('anytime');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [placement, setPlacement] = useState('');
  const [budget, setBudget] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [website, setWebsite] = useState(''); // spam trap: hidden from people
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ request: BookingRequest; link: string } | null>(null);

  const hasHours = Object.values(artist.hours).some(s => s?.length);
  const daysOff = useMemo(() => new Set(artist.daysOff), [artist.daysOff]);
  const isDisabled = (d: string) => daysOff.has(d) || (hasHours && !artist.hours[String(parseDate(d).getDay())]?.length);
  const service = artist.services.find(s => s.id === serviceId);
  const deposit = service ? service.deposit : settings.defaultDeposit;
  // Same rule as the server: a percentage on top of the deposit, waived for Pro artists.
  const fee = artist.isPro ? 0 : Math.round(deposit * settings.depositFeePercent) / 100;
  // Anything typed counts as unsaved work: leaving the page or closing the dialog asks first.
  const started = !done && (step > 1 || !!message.trim() || files.length > 0 || !!guestName || !!guestEmail);
  useUnsavedWarning(started);
  const close = () => {
    if (busy) return;
    if (started && !window.confirm('Discard this booking request? What you entered will be lost.')) return;
    onClose();
  };
  const previews = useMemo(() => files.map(f => URL.createObjectURL(f)), [files]);

  const step2Error = (() => {
    if (intake.requireSize && (!Number(width) || !Number(height))) return 'Enter the approximate width and height.';
    if (intake.requirePlacement && !placement) return 'Choose a placement.';
    if (intake.requireDescription && message.trim().length < 10) return 'Describe your idea in at least a sentence.';
    if (intake.requireBudget && !Number(budget)) return 'Enter your budget.';
    if (intake.requireReferenceImages && files.length === 0) return 'Attach at least one reference image.';
    return '';
  })();

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append(
        'data',
        JSON.stringify({
          artistId: artist.id,
          serviceId: serviceId || null,
          date,
          preferredTime,
          message,
          tattooWidth: width ? Number(width) : null,
          tattooHeight: height ? Number(height) : null,
          bodyPlacement: placement,
          budget: budget ? Number(budget) : null,
          ...(user ? {} : { guestName, guestEmail, guestPhone, website }),
          acceptTerms: accepted,
        }),
      );
      files.forEach(f => fd.append('images', f));
      setDone(await api.post<{ request: BookingRequest; link: string }>('/booking-requests', fd));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Modal title="Request sent!" onClose={onClose} size="md">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
            <CheckIcon className="w-8 h-8" />
          </div>
          <p>
            <strong>{artist.name}</strong> will review your request for <strong>{formatDate(done.request.date)}</strong>.{' '}
            {user ? "You'll get a notification when they respond." : emailReady ? "We'll email you when they respond." : 'Use the link below to see when they respond.'}
          </p>
          {!user && (
            <Notice>
              Save this link — use it to check your request and pay your deposit:
              <a href={done.link} className="block mt-2 font-mono text-xs break-all text-brand-primary">{done.link}</a>
            </Notice>
          )}
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={() => navigate(user ? '/bookings' : `/booking/${done.request.id}?token=${done.request.accessToken}`)}>View request</Button>
          </div>
        </div>
      </Modal>
    );
  }

  const req = (on: boolean) => (on ? ' *' : ' (optional)');

  return (
    <Modal
      title={`Book ${artist.name}`}
      onClose={close}
      size="xl"
      closeDisabled={busy}
      footer={
        <div className="w-full flex items-center justify-between gap-2">
          <span className="text-xs text-brand-gray">Step {step} of 3</span>
          <div className="flex gap-2">
            {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)} disabled={busy}>Back</Button>}
            {step === 1 && <Button onClick={() => setStep(2)} disabled={!date}>Next</Button>}
            {step === 2 && <Button onClick={() => setStep(3)} disabled={!!step2Error}>Next</Button>}
            {step === 3 && (
              <Button onClick={submit} loading={busy} disabled={!accepted || (!user && (!guestName.trim() || !/^\S+@\S+\.\S+$/.test(guestEmail)))}>
                Send request
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 mb-6 overflow-hidden">
        <div className="h-full bg-brand-primary transition-all" style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      {step === 1 && (
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="font-bold text-lg">What are you looking for?</h3>
            {artist.services.length > 0 ? (
              <div className="space-y-2">
                {artist.services.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={serviceId === s.id}
                    onClick={() => setServiceId(s.id)}
                    className={cx('w-full text-left p-3 rounded-xl border transition', serviceId === s.id ? 'border-brand-primary bg-brand-primary/10' : 'border-gray-200 dark:border-gray-700 hover:border-gray-400')}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold">{s.name}</span>
                      <span className="font-bold text-brand-primary">from {dollars(s.price)}</span>
                    </div>
                    <p className="text-xs text-brand-gray">~{s.duration}h · {dollars(s.deposit)} deposit{s.description ? ` · ${s.description}` : ''}</p>
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={!serviceId}
                  onClick={() => setServiceId('')}
                  className={cx('w-full text-left p-3 rounded-xl border transition', !serviceId ? 'border-brand-primary bg-brand-primary/10' : 'border-gray-200 dark:border-gray-700 hover:border-gray-400')}
                >
                  <span className="font-semibold">Not sure / custom</span>
                  <p className="text-xs text-brand-gray">The artist will quote you after reviewing your idea.</p>
                </button>
              </div>
            ) : (
              <p className="text-sm text-brand-gray">{artist.name} will quote you after reviewing your idea.</p>
            )}
            <Select label="Preferred time of day" value={preferredTime} onChange={e => setPreferredTime(e.target.value as PreferredTime)}>
              {Object.entries(PREFERRED_TIMES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-3">Pick a date</h3>
            <Calendar selected={date ? [date] : []} onSelect={setDate} isDisabled={isDisabled} />
            {date && <p className="mt-3 text-sm">Selected: <strong>{formatDate(date)}</strong></p>}
            {hasHours && <p className="text-xs text-brand-gray mt-2">Greyed-out days are when {artist.name} isn't working.</p>}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label={`Width (inches)${req(intake.requireSize)}`} type="number" min="0" step="0.5" value={width} onChange={e => setWidth(e.target.value)} />
              <Input label={`Height (inches)${req(intake.requireSize)}`} type="number" min="0" step="0.5" value={height} onChange={e => setHeight(e.target.value)} />
            </div>
            <Select label={`Placement${req(intake.requirePlacement)}`} value={placement} onChange={e => setPlacement(e.target.value)}>
              <option value="">Choose…</option>
              {settings.bodyPlacements.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
            <Input label={`Budget${req(intake.requireBudget)}`} type="number" min="0" prefix={currencySymbol()} value={budget} onChange={e => setBudget(e.target.value)} />
          </div>
          <div className="space-y-4">
            <Textarea
              label={`Describe your idea${req(intake.requireDescription)}`}
              rows={6}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Style, colours, meaning, any details the artist should know…"
              maxLength={3000}
            />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reference photos{req(intake.requireReferenceImages)}</p>
              <div className="flex flex-wrap gap-2">
                {previews.map((src, i) => (
                  <div key={src} className="relative">
                    <img src={src} alt="" className="w-20 h-20 object-cover rounded-lg" />
                    <button type="button" onClick={() => setFiles(f => f.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-0.5" aria-label="Remove image">
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {files.length < 5 && (
                  <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-brand-gray cursor-pointer hover:border-brand-primary">
                    <PhotoIcon className="w-6 h-6" />
                    <span className="text-[10px] mt-1">Add</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="sr-only"
                      onChange={async e => {
                        const chosen = Array.from(e.target.files || []);
                        e.target.value = '';
                        const all = await prepareImages(chosen);
                        const picked = all.filter(f => f.size <= 8 * 1024 * 1024);
                        if (picked.length < all.length) toast(`${all.length - picked.length} photo${all.length - picked.length > 1 ? 's were' : ' was'} over 8 MB and skipped.`, 'error');
                        setFiles(f => [...f, ...picked].slice(0, 5));
                      }}
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-brand-gray mt-1">Up to 5 images. Large photos are shrunk automatically.</p>
            </div>
          </div>
          {step2Error && <p className="md:col-span-2 text-sm text-amber-700 dark:text-amber-400">{step2Error}</p>}
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            {user ? (
              <Notice>You're booking as <strong>{user.name}</strong> ({user.email}).</Notice>
            ) : (
              <>
                <h3 className="font-bold text-lg">Your contact details</h3>
                <Input label="Full name *" value={guestName} onChange={e => setGuestName(e.target.value)} autoComplete="name" />
                <Input
                  label="Email *"
                  type="email"
                  value={guestEmail}
                  onChange={e => setGuestEmail(e.target.value)}
                  autoComplete="email"
                  hint={emailReady ? "We'll email you updates and a link to pay your deposit." : "You'll get a private link to check your request — save it, as email updates aren't available yet."}
                />
                <Input label="Phone (optional)" type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} autoComplete="tel" />
                <div className="hidden" aria-hidden="true">
                  <label>
                    Website
                    <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
                  </label>
                </div>
                <p className="text-xs text-brand-gray">
                  Have an account? <button type="button" className="text-brand-primary font-semibold" onClick={() => useStore.getState().openAuth('login')}>Log in</button> to track all your bookings in one place.
                </p>
              </>
            )}
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 text-sm space-y-2 h-fit">
            <h3 className="font-bold text-base mb-2">Summary</h3>
            <Row k="Artist" v={artist.name} />
            <Row k="Service" v={service?.name || 'Custom tattoo'} />
            <Row k="Date" v={`${formatDate(date)} · ${PREFERRED_TIMES[preferredTime]}`} />
            {(width || height) && <Row k="Size" v={`${width || '?'}" × ${height || '?'}"`} />}
            {placement && <Row k="Placement" v={placement} />}
            {files.length > 0 && <Row k="References" v={`${files.length} photo${files.length > 1 ? 's' : ''}`} />}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
              <Row k="Deposit (after approval)" v={deposit > 0 ? dollars(deposit) : 'None'} />
              {deposit > 0 && fee > 0 && <Row k={`Booking fee (${settings.depositFeePercent}%)`} v={dollars(fee)} />}
              {deposit > 0 && fee > 0 && <Row k="Total due after approval" v={dollars(deposit + fee)} />}
              <p className="text-xs text-brand-gray mt-1">
                Nothing is charged now. You'll pay {deposit > 0 ? 'the deposit' : 'any deposit'} once {artist.name} approves your request (they may adjust it). The deposit goes towards the price of your tattoo.
              </p>
            </div>
          </div>
          <label className="md:col-span-2 flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" className="mt-1" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
            <span>
              I'm 18 or older and I agree to the{' '}
              {policyPage ? (
                <a href={`/p/${policyPage.slug}`} target="_blank" rel="noopener noreferrer" className="text-brand-primary underline">booking & cancellation policy</a>
              ) : (
                'booking & cancellation policy'
              )}
              , including that deposits may be non-refundable.
            </span>
          </label>
          {error && <p className="md:col-span-2 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
        </div>
      )}
    </Modal>
  );
};

const Row: React.FC<{ k: string; v: React.ReactNode }> = ({ k, v }) => (
  <div className="flex justify-between gap-4">
    <span className="text-brand-gray">{k}</span>
    <span className="font-medium text-right">{v}</span>
  </div>
);
