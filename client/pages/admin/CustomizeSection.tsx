// Admin → Customize: branding, colors, home page content, announcement, contact & social links.
import React from 'react';
import { Button, Field, Input, PageHeader, Select, Textarea, Toggle, cx, inputClass } from '../../components/ui';
import { BellIcon, DocumentIcon, EyeIcon, GlobeIcon, PaletteIcon, PhotoIcon } from '../../components/Icons';
import { FacebookIcon, InstagramIcon, NeedleIcon, TikTokIcon } from '../../components/Icons';
import type { SiteSettings } from '../../../shared/types';
import { brandVariables, buttonStyle } from '../../lib/theme';
import { AsyncView, ImageField, LinkButton, SaveBar, SettingsCard, useRunner, useUnsavedWarning } from './shared';
import { useSettingsDraft } from './useSettingsDraft';

const KEYS = [
  'siteName', 'tagline', 'logoUrl', 'faviconUrl', 'primaryColor', 'secondaryColor', 'defaultTheme',
  'heroTitle', 'heroHighlight', 'heroSubtitle', 'heroImageUrl', 'aboutTitle', 'aboutText',
  'announcementEnabled', 'announcementText', 'contactEmail', 'instagramUrl', 'tiktokUrl', 'facebookUrl', 'footerText',
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PRESETS: { name: string; primary: string; secondary: string }[] = [
  { name: 'Vermilion (default)', primary: '#D0281C', secondary: '#2F5D50' },
  { name: 'Black & bone', primary: '#1C1917', secondary: '#78716C' },
  { name: 'Oxblood & brass', primary: '#7F1D1D', secondary: '#A16207' },
  { name: 'Sailor', primary: '#1E3A5F', secondary: '#B7352B' },
  { name: 'Moss', primary: '#3F6212', secondary: '#57534E' },
  { name: 'Rose', primary: '#9F1239', secondary: '#57534E' },
];

const ColorField: React.FC<{ label: string; hint: string; value: string; onChange: (v: string) => void }> = ({ label, hint, value, onChange }) => {
  const valid = HEX.test(value);
  const style = valid ? buttonStyle(value) : null;
  const fullHint =
    style === 'deeper'
      ? `${hint} Buttons use a slightly deeper shade of it so their white text stays easy to read.`
      : style === 'dark-text'
        ? `${hint} It's a bright color, so text on buttons will be dark to stay easy to read.`
        : hint;
  return (
    <Field label={label} hint={fullHint} error={valid ? undefined : 'Use a hex color like #D0281C'}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={valid ? value.toLowerCase() : '#000000'}
          onChange={e => onChange(e.target.value.toUpperCase())}
          className="h-11 w-14 flex-shrink-0 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-1 cursor-pointer"
        />
        <input
          type="text"
          aria-label={`${label} hex code`}
          value={value}
          maxLength={7}
          spellCheck={false}
          onChange={e => {
            const v = e.target.value.trim();
            onChange(v && !v.startsWith('#') ? `#${v}` : v);
          }}
          className={cx(inputClass, 'font-mono uppercase')}
        />
      </div>
    </Field>
  );
};

/** A small mock of the home page using the draft settings. */
const LivePreview: React.FC<{ s: SiteSettings }> = ({ s }) => {
  const dark = s.defaultTheme === 'dark';
  const style = {
    ...brandVariables(s.primaryColor, s.secondaryColor),
    '--brand-primary-text': `var(--brand-primary-text-${dark ? 'dark' : 'light'})`,
    '--brand-secondary-text': `var(--brand-secondary-text-${dark ? 'dark' : 'light'})`,
  } as React.CSSProperties;
  const socials = [s.instagramUrl && InstagramIcon, s.tiktokUrl && TikTokIcon, s.facebookUrl && FacebookIcon].filter(Boolean) as React.FC<{ className?: string }>[];

  return (
    <div style={style} className={cx('rounded-2xl overflow-hidden border text-left select-none', dark ? 'bg-brand-dark text-white border-gray-800' : 'bg-brand-light text-brand-dark border-gray-200')}>
      {s.announcementEnabled && s.announcementText.trim() && (
        <div className={cx('text-[11px] text-center px-3 py-1.5', dark ? 'bg-gray-800 text-gray-100' : 'bg-brand-dark text-brand-light')}>{s.announcementText}</div>
      )}
      <div className={cx('flex items-center justify-between gap-2 px-4 py-3 border-b', dark ? 'border-white/10' : 'border-black/10')}>
        <div className="flex items-center gap-2 min-w-0">
          {s.logoUrl ? (
            <img src={s.logoUrl} alt="" className="h-6 w-auto max-w-[80px] object-contain" />
          ) : (
            <NeedleIcon className="w-5 h-5 text-brand-primary flex-shrink-0" />
          )}
          <span className="font-display text-sm truncate">{s.siteName || 'Your site'}</span>
        </div>
        <span className="text-[11px] px-2.5 py-1 rounded bg-brand-solid text-on-primary font-semibold flex-shrink-0">Sign up</span>
      </div>
      <div className="relative px-5 py-10 text-left overflow-hidden">
        {s.heroImageUrl && (
          <>
            <img src={s.heroImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className={cx('absolute inset-0', dark ? 'bg-brand-dark/70' : 'bg-white/70')} />
          </>
        )}
        <div className="relative">
          <h3 className="text-2xl font-display leading-tight">
            {s.heroTitle}
            {s.heroHighlight && <span className={cx('block', !s.heroImageUrl && 'text-brand-primary')}>{s.heroHighlight}</span>}
          </h3>
          {s.heroSubtitle && <p className="mt-3 text-xs opacity-80 line-clamp-3">{s.heroSubtitle}</p>}
          <div className="mt-4 flex gap-2 flex-wrap">
            <span className="bg-brand-solid text-on-primary text-xs font-semibold px-3 py-2 rounded-lg">Find an artist</span>
            <span className={cx('text-xs font-semibold px-3 py-2 rounded-lg border', dark ? 'border-white/20' : 'border-black/15')}>Find a guest spot</span>
          </div>
        </div>
      </div>
      {(s.aboutTitle || s.aboutText) && (
        <div className={cx('px-5 py-5 border-t', dark ? 'border-white/10' : 'border-black/10')}>
          <p className="font-bold text-sm">{s.aboutTitle}</p>
          <p className="text-[11px] opacity-70 mt-1 line-clamp-3">{s.aboutText}</p>
        </div>
      )}
      <div className={cx('px-5 py-3 border-t flex items-center justify-between gap-2 text-[10px] opacity-80', dark ? 'border-white/10' : 'border-black/10')}>
        <span className="truncate">{s.footerText || `© ${new Date().getFullYear()} ${s.siteName}`}</span>
        <span className="flex gap-1.5 text-brand-primary">
          {socials.map((Icon, i) => (
            <Icon key={i} className="w-3.5 h-3.5" />
          ))}
        </span>
      </div>
    </div>
  );
};

/** Adds https:// to a link that was typed without it. */
const normalizeUrl = (v: string) => {
  const t = v.trim();
  return t && !/^https?:\/\//i.test(t) ? `https://${t}` : t;
};

export const CustomizeSection: React.FC = () => {
  const { state, draft, set, dirty, discard, save } = useSettingsDraft(KEYS);
  const { run, busy } = useRunner();
  useUnsavedWarning(dirty);

  const problem = !draft
    ? null
    : !draft.siteName.trim()
      ? 'Your site needs a name.'
      : !HEX.test(draft.primaryColor) || !HEX.test(draft.secondaryColor)
        ? 'Fix the color codes before saving.'
        : draft.contactEmail.trim() && !EMAIL.test(draft.contactEmail.trim())
          ? 'The contact email doesn’t look right.'
          : null;

  const onSave = () => run('save', () => save(), 'Saved! Your site has been updated.');

  return (
    <>
      <PageHeader
        title="Customize"
        subtitle="Your brand, colors and the words people see on your site."
        actions={
          <>
            <LinkButton href="/" target="_blank" rel="noopener noreferrer">
              <EyeIcon className="w-4 h-4" /> View site
            </LinkButton>
            <Button onClick={onSave} loading={busy('save')} disabled={!dirty || !!problem}>
              Save changes
            </Button>
          </>
        }
      />
      <AsyncView state={state}>
        {() =>
          draft && (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] items-start">
              <div className="xl:order-2 xl:sticky xl:top-24 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-gray">Live preview</p>
                <LivePreview s={draft} />
                <p className="text-xs text-brand-gray">A rough sketch of your home page. Save to see the real thing.</p>
              </div>

              <div className="xl:order-1 space-y-6 min-w-0">
                <SettingsCard title="Brand" description="Your name and logo appear in the header, emails and browser tab." icon={<NeedleIcon className="w-5 h-5" />}>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Input
                      label="Site name"
                      value={draft.siteName}
                      maxLength={60}
                      onChange={e => set('siteName', e.target.value)}
                      error={draft.siteName.trim() ? undefined : 'Required'}
                    />
                    <Input
                      label="Tagline"
                      value={draft.tagline}
                      maxLength={200}
                      onChange={e => set('tagline', e.target.value)}
                      hint="A short line used in search results and link previews."
                    />
                  </div>
                  <ImageField
                    label="Logo"
                    value={draft.logoUrl}
                    onChange={url => set('logoUrl', url)}
                    hint="Shown in the header and footer in place of your site name. A transparent PNG about 200px wide works best."
                  />
                  <ImageField
                    label="Favicon (browser tab icon)"
                    value={draft.faviconUrl}
                    onChange={url => set('faviconUrl', url)}
                    previewClassName="h-16 w-16"
                    hint="The tiny icon in the browser tab. Use a square PNG, at least 64×64 pixels."
                  />
                </SettingsCard>

                <SettingsCard title="Colors & theme" description="Buttons, links and highlights use your brand colors." icon={<PaletteIcon className="w-5 h-5" />}>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <ColorField label="Main color" hint="Buttons, links and highlights." value={draft.primaryColor} onChange={v => set('primaryColor', v)} />
                    <ColorField label="Accent color" hint="Used in gradients next to the main color." value={draft.secondaryColor} onChange={v => set('secondaryColor', v)} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick palettes</p>
                    <div className="flex flex-wrap gap-2">
                      {PRESETS.map(p => {
                        const active = draft.primaryColor.toUpperCase() === p.primary && draft.secondaryColor.toUpperCase() === p.secondary;
                        return (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() => {
                              set('primaryColor', p.primary);
                              set('secondaryColor', p.secondary);
                            }}
                            className={cx(
                              'flex items-center gap-2 rounded-full border pl-1.5 pr-3 py-1 text-xs font-semibold transition-colors',
                              active ? 'border-brand-primary text-brand-primary' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
                            )}
                          >
                            <span className="w-5 h-5 rounded-full" style={{ background: `linear-gradient(135deg, ${p.primary} 50%, ${p.secondary} 50%)` }} />
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Select
                    label="Default look"
                    value={draft.defaultTheme}
                    onChange={e => set('defaultTheme', e.target.value === 'light' ? 'light' : 'dark')}
                    hint="What first-time visitors see. They can still switch with the sun/moon button."
                    className="sm:max-w-xs"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </Select>
                </SettingsCard>

                <SettingsCard title="Home page" description="The big headline at the top of your home page, plus the About section." icon={<PhotoIcon className="w-5 h-5" />}>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Input label="Headline" value={draft.heroTitle} maxLength={120} onChange={e => set('heroTitle', e.target.value)} hint="e.g. Find Your Space." />
                    <Input
                      label="Highlighted line"
                      value={draft.heroHighlight}
                      maxLength={120}
                      onChange={e => set('heroHighlight', e.target.value)}
                      hint="Shown under the headline in your brand colors."
                    />
                  </div>
                  <Textarea label="Intro text" rows={3} value={draft.heroSubtitle} maxLength={500} onChange={e => set('heroSubtitle', e.target.value)} />
                  <ImageField
                    label="Background photo (optional)"
                    value={draft.heroImageUrl}
                    onChange={url => set('heroImageUrl', url)}
                    previewClassName="h-28 w-full sm:w-64"
                    hint="A wide photo (at least 1600px across) behind the headline. Darker photos keep the text easy to read."
                  />
                  <Input label="About section title" value={draft.aboutTitle} maxLength={120} onChange={e => set('aboutTitle', e.target.value)} />
                  <Textarea
                    label="About section text"
                    rows={5}
                    value={draft.aboutText}
                    maxLength={5000}
                    onChange={e => set('aboutText', e.target.value)}
                    hint="Tell visitors what your marketplace is about and who it's for."
                  />
                </SettingsCard>

                <SettingsCard title="Announcement banner" description="A bar across the top of every page. Great for holiday hours, promotions or news." icon={<BellIcon className="w-5 h-5" />}>
                  <Toggle
                    checked={draft.announcementEnabled}
                    onChange={v => set('announcementEnabled', v)}
                    label="Show the banner"
                    description={draft.announcementEnabled ? 'Visible to everyone right now (after you save).' : 'Hidden.'}
                  />
                  <Input
                    label="Banner text"
                    value={draft.announcementText}
                    maxLength={300}
                    placeholder="e.g. Flash day this Saturday, walk-ins welcome!"
                    onChange={e => set('announcementText', e.target.value)}
                    error={draft.announcementEnabled && !draft.announcementText.trim() ? 'Add some text, or the banner won’t show.' : undefined}
                  />
                </SettingsCard>

                <SettingsCard title="Contact & social" description="Shown in your footer so people can reach and follow you. Leave blank to hide." icon={<GlobeIcon className="w-5 h-5" />}>
                  <Input
                    label="Contact email"
                    type="email"
                    value={draft.contactEmail}
                    maxLength={200}
                    placeholder="hello@yourstudio.com"
                    hint="Shown in the footer and policy pages. Messages from the Contact form are sent here (otherwise to every admin)."
                    onChange={e => set('contactEmail', e.target.value)}
                    error={draft.contactEmail.trim() && !EMAIL.test(draft.contactEmail.trim()) ? 'That doesn’t look like an email address.' : undefined}
                  />
                  <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
                    <Input
                      label="Instagram"
                      value={draft.instagramUrl}
                      maxLength={300}
                      placeholder="https://instagram.com/…"
                      onChange={e => set('instagramUrl', e.target.value)}
                      onBlur={e => set('instagramUrl', normalizeUrl(e.target.value))}
                    />
                    <Input
                      label="TikTok"
                      value={draft.tiktokUrl}
                      maxLength={300}
                      placeholder="https://tiktok.com/@…"
                      onChange={e => set('tiktokUrl', e.target.value)}
                      onBlur={e => set('tiktokUrl', normalizeUrl(e.target.value))}
                    />
                    <Input
                      label="Facebook"
                      value={draft.facebookUrl}
                      maxLength={300}
                      placeholder="https://facebook.com/…"
                      onChange={e => set('facebookUrl', e.target.value)}
                      onBlur={e => set('facebookUrl', normalizeUrl(e.target.value))}
                    />
                  </div>
                </SettingsCard>

                <SettingsCard title="Footer" icon={<DocumentIcon className="w-5 h-5" />}>
                  <Textarea
                    label="Footer text"
                    rows={2}
                    value={draft.footerText}
                    maxLength={500}
                    placeholder={`© ${new Date().getFullYear()} ${draft.siteName}. All rights reserved.`}
                    onChange={e => set('footerText', e.target.value)}
                    hint="Small print at the bottom of every page. Links to your content pages are added automatically (see Pages)."
                  />
                </SettingsCard>

                <SaveBar dirty={dirty} saving={busy('save')} canSave={!problem} problem={problem} onSave={onSave} onDiscard={discard} />
              </div>
            </div>
          )
        }
      </AsyncView>
    </>
  );
};
