// Public pro profile, laid out like the template's service details page: a photo gallery, the pro's card with
// booking and messaging, services, hours, location and reviews.
import React, { useState } from 'react';
import { api, errorMessage } from '../api';
import { Link, navigate } from '../router';
import { useStore } from '../store';
import { dollars, formatDate, timeAgo } from '../lib/format';
import { BookingRequestModal } from '../components/BookingRequestModal';
import { ReportModal } from '../components/ReportModal';
import { Avatar, Badge, Button, Card, EmptyState, ErrorBox, PageBanner, PageLoader, StarRating, cx, useApi } from '../components/ui';
import { MapEmbed } from '../components/MapEmbed';
import {
  ArrowLeftIcon, ArrowRightIcon, CalendarIcon, ChatIcon, CheckBadgeIcon, FacebookIcon, FlagIcon, GlobeIcon, InstagramIcon,
  LocationIcon, TikTokIcon, XIcon,
} from '../components/Icons';
import type { ArtistDetail, PortfolioImage } from '../../shared/types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: m ? '2-digit' : undefined });
}

const Lightbox: React.FC<{ images: { url: string; caption?: string }[]; index: number; onClose: () => void; onIndex: (i: number) => void }> = ({ images, index, onClose, onIndex }) => {
  const img = images[index];
  const go = (d: number) => onIndex((index + d + images.length) % images.length);
  return (
    <div className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/80 hover:text-white" aria-label="Close"><XIcon className="w-8 h-8" /></button>
      {images.length > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); go(-1); }} className="absolute left-2 sm:left-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Previous"><ArrowLeftIcon className="w-6 h-6" /></button>
          <button onClick={e => { e.stopPropagation(); go(1); }} className="absolute right-2 sm:right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Next"><ArrowRightIcon className="w-6 h-6" /></button>
        </>
      )}
      <figure onClick={e => e.stopPropagation()} className="max-w-5xl max-h-full">
        <img src={img.url} alt={img.caption || ''} className="max-h-[85dvh] max-w-full object-contain rounded-lg" />
        {img.caption && <figcaption className="text-center text-white/80 text-sm mt-3">{img.caption}</figcaption>}
      </figure>
    </div>
  );
};

/** Large photo with previous/next buttons and a row of thumbnails; click the photo to view it full screen. */
const Gallery: React.FC<{ images: PortfolioImage[]; name: string; onOpen: (i: number) => void }> = ({ images, name, onOpen }) => {
  const [index, setIndex] = useState(0);
  const go = (d: number) => setIndex(i => (i + d + images.length) % images.length);
  const img = images[index];
  const arrow = 'absolute top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl flex items-center justify-center bg-brand-solid text-on-primary shadow-lg hover:brightness-110 transition enabled:active:scale-95';
  return (
    <div className="relative rounded-2xl overflow-hidden bg-gray-900">
      <button type="button" onClick={() => onOpen(index)} className="block w-full aspect-[4/3] sm:aspect-[16/10]" aria-label="View full screen">
        <img src={img.url} alt={img.caption || `Work by ${name}`} className="w-full h-full object-cover" />
      </button>
      {images.length > 1 && (
        <>
          <button type="button" className={cx(arrow, 'left-3 sm:left-4')} onClick={() => go(-1)} aria-label="Previous photo"><ArrowLeftIcon className="w-5 h-5" /></button>
          <button type="button" className={cx(arrow, 'right-3 sm:right-4')} onClick={() => go(1)} aria-label="Next photo"><ArrowRightIcon className="w-5 h-5" /></button>
          <div className="absolute bottom-3 inset-x-0 flex justify-center px-14">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide max-w-full p-1">
              {images.map((im, i) => (
                <button
                  key={im.url}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Photo ${i + 1}`}
                  aria-current={i === index}
                  className={cx('flex-shrink-0 w-16 h-12 sm:w-20 sm:h-14 rounded-lg overflow-hidden border-2 transition', i === index ? 'border-white' : 'border-white/30 opacity-80 hover:opacity-100')}
                >
                  <img src={im.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section>
    <h2 className="text-2xl font-display mb-4">{title}</h2>
    {children}
  </section>
);

export const ArtistProfilePage: React.FC<{ id: string }> = ({ id }) => {
  const { data: artist, error, loading, reload } = useApi<ArtistDetail>(`/artists/${id}`);
  const user = useStore(s => s.user);
  const settings = useStore(s => s.config!.settings);
  const openAuth = useStore(s => s.openAuth);
  const toast = useStore(s => s.toast);
  const [booking, setBooking] = useState<{ serviceId?: string } | null>(null);
  const [reporting, setReporting] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [messaging, setMessaging] = useState(false);

  if (error) return <div className="container mx-auto px-4 py-10"><ErrorBox message={error} onRetry={reload} /></div>;
  if (loading || !artist) return <PageLoader />;

  const isSelf = user?.id === artist.id;
  const canBook = !isSelf && settings.features.clientBooking && user?.role !== 'shop-owner' && user?.role !== 'admin';
  const workingDays = DAYS.map((d, i) => ({ day: d, slots: artist.hours[String(i)] || [] }));
  const hasHours = workingDays.some(d => d.slots.length);
  const price = artist.services.length ? Math.min(...artist.services.map(s => s.price)) : null;
  const where = artist.address || artist.city;
  const socials = [
    artist.socials.instagram && { href: artist.socials.instagram, Icon: InstagramIcon, label: 'Instagram' },
    artist.socials.tiktok && { href: artist.socials.tiktok, Icon: TikTokIcon, label: 'TikTok' },
    artist.socials.facebook && { href: artist.socials.facebook, Icon: FacebookIcon, label: 'Facebook' },
    artist.socials.website && { href: artist.socials.website, Icon: GlobeIcon, label: 'Website' },
  ].filter(Boolean) as { href: string; Icon: React.FC<{ className?: string }>; label: string }[];

  const startBooking = (serviceId?: string) => {
    if (!user && !settings.features.guestBooking) {
      toast('Please log in or create a free account to book.');
      openAuth('login');
      return;
    }
    setBooking({ serviceId });
  };

  const message = async () => {
    if (!user) {
      toast('Log in to send messages.');
      openAuth('login');
      return;
    }
    setMessaging(true);
    try {
      const { id: convoId } = await api.post<{ id: string }>('/conversations', { userId: artist.id });
      navigate(`/messages/${convoId}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setMessaging(false);
    }
  };

  return (
    <div>
      <PageBanner title={artist.name} crumbs={[{ label: 'Home', to: '/' }, { label: artist.category || 'Pros', to: artist.category ? `/artists?category=${encodeURIComponent(artist.category)}` : '/artists' }, { label: artist.name }]} />

      <div className="container mx-auto px-4 py-10 md:py-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
        <div className="space-y-10 min-w-0">
          {artist.portfolio.length > 0 ? (
            <Gallery images={artist.portfolio} name={artist.name} onOpen={setLightbox} />
          ) : (
            <Card><EmptyState title="No photos yet" /></Card>
          )}

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
            <div className="min-w-0">
              <p className="text-brand-gray">{[artist.category, artist.specialty].filter(Boolean).join(' · ') || 'Pro'}</p>
              <p className="text-2xl font-display mt-1">{artist.name}</p>
              {where && <p className="mt-1 text-sm text-brand-gray flex items-center gap-1"><LocationIcon className="w-4 h-4" />{where}</p>}
            </div>
            <div className="sm:text-right flex-shrink-0">
              {price !== null && <p className="text-2xl font-display"><span className="text-base text-brand-gray font-sans font-normal">From </span>{dollars(price)}</p>}
              {artist.reviewCount > 0 ? <StarRating value={artist.averageRating} showValue count={artist.reviewCount} /> : <p className="text-sm text-brand-gray">No reviews yet</p>}
            </div>
          </div>

          {artist.bio && (
            <Section title="About">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{artist.bio}</p>
            </Section>
          )}

          {artist.services.length > 0 && (
            <Section title="Services">
              <ul className="divide-y divide-gray-200 dark:divide-gray-800 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                {artist.services.map(sv => (
                  <li key={sv.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{sv.name}</p>
                      <p className="text-sm text-brand-gray">About {sv.duration} {sv.duration === 1 ? 'hour' : 'hours'}{sv.description ? ` · ${sv.description}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-semibold">from {dollars(sv.price)}</p>
                        <p className="text-xs text-brand-gray">{dollars(sv.deposit)} deposit</p>
                      </div>
                      {canBook && <Button size="sm" variant="outline" onClick={() => startBooking(sv.id)}>Book</Button>}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {hasHours && (
            <Section title="Opening hours">
              <ul className="grid sm:grid-cols-2 gap-x-10 gap-y-1.5 text-sm">
                {workingDays.map(({ day, slots }) => (
                  <li key={day} className="flex justify-between gap-4 border-b border-dashed border-gray-200 dark:border-gray-800 py-1.5">
                    <span className="text-brand-gray">{day}</span>
                    <span>{slots.length ? slots.map(sl => `${fmtTime(sl.start)}–${fmtTime(sl.end)}`).join(', ') : 'Closed'}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {settings.features.reviews && (
            <Section title="Reviews">
              {artist.reviews.length === 0 ? (
                <Card><EmptyState title="No reviews yet">Reviews appear here after completed appointments.</EmptyState></Card>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 rounded-2xl bg-brand-tint dark:bg-gray-900 p-5">
                    <p className="text-4xl font-display">{artist.averageRating.toFixed(1)}</p>
                    <div>
                      <StarRating value={artist.averageRating} />
                      <p className="text-sm text-brand-gray mt-0.5">{artist.reviewCount === 1 ? '1 review' : `${artist.reviewCount.toLocaleString()} reviews`} from completed appointments</p>
                    </div>
                  </div>
                  {artist.reviews.map(r => (
                    <article key={r.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={r.authorName} size="sm" />
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{r.authorName}</p>
                            <p className="text-xs text-brand-gray">{timeAgo(r.createdAt)}</p>
                          </div>
                        </div>
                        <StarRating value={r.rating} size="w-4 h-4" />
                      </div>
                      {r.text && <p className="mt-3 text-gray-700 dark:text-gray-300">{r.text}</p>}
                    </article>
                  ))}
                </div>
              )}
            </Section>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <h2 className="text-xl font-display mb-4">Your pro</h2>
            <div className="flex items-center gap-4">
              <Avatar name={artist.name} url={artist.avatarUrl} size="lg" />
              <div className="min-w-0">
                <p className="font-semibold text-lg">
                  {artist.name}
                  {artist.isVerified && <CheckBadgeIcon className="inline w-5 h-5 ml-1 align-[-0.2em] text-brand-secondary" title="Verified" />}
                </p>
                {artist.category && <p className="text-sm text-brand-gray">{artist.category}</p>}
                {artist.isPro && <Badge tone="brand" className="mt-1">Pro member</Badge>}
              </div>
            </div>
            {artist.guestSpot && (
              <div className="mt-4 rounded-xl bg-brand-tint dark:bg-gray-800 p-3 text-sm">
                <p className="font-semibold flex items-center gap-1.5"><CalendarIcon className="w-4 h-4 text-brand-primary" /> Visiting {artist.guestSpot.city}</p>
                <p className="text-brand-gray">
                  At <Link className="underline" to={`/shops/${artist.guestSpot.shopId}`}>{artist.guestSpot.shopName}</Link>, {formatDate(artist.guestSpot.startDate, { month: 'short', day: 'numeric' })} – {formatDate(artist.guestSpot.endDate, { month: 'short', day: 'numeric' })}
                </p>
              </div>
            )}
            {!isSelf ? (
              <div className="grid gap-2 mt-6">
                {canBook && <Button size="lg" onClick={() => startBooking()}><CalendarIcon className="w-5 h-5" /> Request a booking</Button>}
                {settings.features.messaging && <Button variant="outline" onClick={message} loading={messaging}><ChatIcon className="w-5 h-5" /> Message</Button>}
              </div>
            ) : (
              <Button variant="outline" block className="mt-6" onClick={() => navigate('/dashboard?tab=profile')}>Edit my profile</Button>
            )}
            {socials.length > 0 && (
              <div className="flex gap-2 mt-5">
                {socials.map(({ href, Icon, label }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-brand-primary hover:border-brand-primary transition-colors">
                    <Icon className="w-5 h-5" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {where && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
              <h2 className="text-xl font-display mb-3">Location</h2>
              <p className="flex items-start gap-2 text-sm mb-3"><LocationIcon className="w-5 h-5 text-brand-primary mt-px" />{where}</p>
              <MapEmbed lat={null} lng={null} address={where} />
            </div>
          )}

          {user && !isSelf && (
            <button onClick={() => setReporting(true)} className="text-xs text-brand-gray hover:text-red-500 flex items-center gap-1">
              <FlagIcon className="w-4 h-4" /> Report this profile
            </button>
          )}
        </aside>
      </div>

      {booking && <BookingRequestModal artist={artist} serviceId={booking.serviceId} onClose={() => setBooking(null)} />}
      {reporting && <ReportModal targetType="user" targetId={artist.id} label={artist.name} onClose={() => setReporting(false)} />}
      {lightbox !== null && <Lightbox images={artist.portfolio} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
};
