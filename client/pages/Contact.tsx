// "Contact us": visitors message the site owner (it lands in Admin → Inbox and the owner's email).
import React, { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import { Link } from '../router';
import { useStore } from '../store';
import { Button, Card, Input, PageHeader, Textarea } from '../components/ui';
import { CheckIcon, InstagramIcon } from '../components/Icons';
import { useUnsavedWarning } from '../lib/unsaved';

export const ContactPage: React.FC = () => {
  const user = useStore(s => s.user);
  const settings = useStore(s => s.config!.settings);
  const pages = useStore(s => s.config!.pages);
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', message: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  useUnsavedWarning(!!form.message.trim());

  useEffect(() => {
    document.title = `Contact · ${settings.siteName}`;
    return () => {
      document.title = settings.siteName;
    };
  }, [settings.siteName]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.message.trim().length < 10) return setError('Please write a little more so we can help.');
    setBusy(true);
    try {
      await api.post('/contact', form);
      setSentTo(form.email.trim());
      setForm(f => ({ ...f, message: '' }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const faq = pages.find(p => p.slug === 'faq');

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="Contact us" subtitle="Questions about a booking, a guest spot or your account? Send us a message and we'll reply by email." />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem]">
        <Card>
          {sentTo ? (
            <div className="text-center py-6" role="status">
              <span className="mx-auto mb-4 w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                <CheckIcon className="w-6 h-6" />
              </span>
              <h2 className="text-xl font-bold mb-1">Message sent</h2>
              <p className="text-brand-gray">Thanks! We&apos;ll reply to {sentTo} as soon as we can.</p>
              <Button variant="outline" className="mt-5" onClick={() => setSentTo(null)}>
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Your name" value={form.name} onChange={set('name')} required maxLength={100} autoComplete="name" />
                <Input label="Your email" type="email" value={form.email} onChange={set('email')} required maxLength={200} autoComplete="email" hint="We'll reply here." />
              </div>
              <Textarea label="Message" rows={6} value={form.message} onChange={set('message')} required maxLength={5000} />
              {/* Hidden from people; bots that fill in every field give themselves away. */}
              <div className="hidden" aria-hidden="true">
                <label>
                  Website
                  <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
                </label>
              </div>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}
              <div className="flex justify-end">
                <Button type="submit" loading={busy} disabled={!form.name.trim() || !form.email.trim() || !form.message.trim()}>
                  Send message
                </Button>
              </div>
            </form>
          )}
        </Card>
        <aside className="space-y-4 text-sm">
          {faq && (
            <Card>
              <h2 className="font-semibold mb-1">Quick answers</h2>
              <p className="text-brand-gray">
                Many questions are answered in our{' '}
                <Link to="/p/faq" className="text-brand-primary underline">
                  FAQ
                </Link>
                .
              </p>
            </Card>
          )}
          {(settings.contactEmail || settings.instagramUrl) && (
            <Card>
              <h2 className="font-semibold mb-2">Other ways to reach us</h2>
              <ul className="space-y-2 text-brand-gray">
                {settings.contactEmail && (
                  <li>
                    <a href={`mailto:${settings.contactEmail}`} className="text-brand-primary underline break-all">
                      {settings.contactEmail}
                    </a>
                  </li>
                )}
                {settings.instagramUrl && (
                  <li>
                    <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-brand-primary underline">
                      <InstagramIcon className="w-4 h-4" /> Instagram
                    </a>
                  </li>
                )}
              </ul>
            </Card>
          )}
          <p className="text-xs text-brand-gray px-1">
            For a question about a specific appointment, it&apos;s usually fastest to message your artist directly{user ? ' from Messages' : ''}.
          </p>
        </aside>
      </div>
    </div>
  );
};
