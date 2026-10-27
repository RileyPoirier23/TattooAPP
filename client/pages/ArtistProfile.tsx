// Public artist profile: portfolio, services, hours, reviews, and booking / messaging actions.
import React, { useState } from 'react';
import { api, errorMessage } from '../api';
import { Link, navigate } from '../router';
import { useStore } from '../store';
import { dollars, formatDate, timeAgo } from '../lib/format';
import { BookingRequestModal } from '../components/BookingRequestModal';
import { ReportModal } from '../components/ReportModal';
import { Avatar, Badge, Button, Card, EmptyState, ErrorBox, PageLoader, StarRating, useApi } from '../components/ui';
import {
  ArrowLeftIcon, ArrowRightIcon, CalendarIcon, ChatIcon, CheckBadgeIcon, FacebookIcon, FlagIcon, GlobeIcon, InstagramIcon,
  LocationIcon, SparklesIcon, TikTokIcon, XIcon,
} from '../components/Icons';
import type { ArtistDetail } from '../../shared/types';

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

export const ArtistProfilePage: React.FC<{ id: string }> = ({ id }) => {
  const { data: artist, error, loading, reload } = useApi<ArtistDetail>(`/artists/${id}`);
  const user = useStore(s => s.user);
  const settings = useStore(s => s.config!.settings);
  const openAuth = useStore(s => s.openAuth);
  const toast = useStore(s => s.toast);
  const [booking, setBooking] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [messaging, setMessaging] = useState(false);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (loading || !artist) return <PageLoader />;

  const isSelf = user?.id === artist.id;
  const workingDays = DAYS.map((d, i) => ({ day: d, slots: artist.hours[String(i)] || [] }));
  const hasHours = workingDays.some(d => d.slots.length);
  const socials = [
    artist.socials.instagram && { href: artist.socials.instagram, Icon: InstagramIcon, label: 'Instagram' },
    artist.socials.tiktok && { href: artist.socials.tiktok, Icon: TikTokIcon, label: 'TikTok' },
    artist.socials.facebook && { href: artist.socials.facebook, Icon: FacebookIcon, label: 'Facebook' },
    artist.socials.website && { href: artist.socials.website, Icon: GlobeIcon, label: 'Website' },
  ].filter(Boolean) as { href: string; Icon: React.FC<{ className?: string }>; label: string }[];

  const startBooking = () => {
    if (!user && !settings.features.guestBooking) {
      toast('Please log in or create a free account to book.');
      openAuth('login');
      return;
    }
    setBooking(true);
  };

  const message = async () => {
    if (!user) {
      toast('Log in to message artists.');
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
    <div className="max-w-6xl mx-auto">
      <Link to="/artists" className="inline-flex items-center gap-1 text-sm text-brand-gray hover:text-brand-primary mb-4">
        <ArrowLeftIcon className="w-4 h-4" /> All artists
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <div className="flex items-center gap-4">
              <Avatar name={artist.name} url={artist.avatarUrl} size="lg" />
              <div className="min-w-0">
                <h1 className="text-2xl font-extrabold">
                  {artist.name}
                  {artist.isVerified && <CheckBadgeIcon className="inline w-6 h-6 ml-1.5 align-[-0.25em] text-brand-secondary" title="Verified artist" />}
                </h1>
                {artist.specialty && <p className="font-semibold text-brand-primary">{artist.specialty}</p>}
                {artist.city && <p className="text-sm text-brand-gray flex items-center gap-1"><LocationIcon className="w-4 h-4" />{artist.city}</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {artist.reviewCount > 0 ? <StarRating value={artist.averageRating} showValue count={artist.reviewCount} /> : <span className="text-sm text-brand-gray">No reviews yet</span>}
              {artist.isPro && <Badge tone="purple"><SparklesIcon className="w-3.5 h-3.5" />Pro</Badge>}
            </div>
            {artist.guestSpot && (
              <div className="mt-4 rounded-xl bg-sky-500/10 border border-sky-500/30 p-3 text-sm">
                <p className="font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-1.5"><CalendarIcon className="w-4 h-4" /> Guest spot in {artist.guestSpot.city}</p>
                <p className="text-brand-gray">
                  At <Link className="underline" to={`/shops/${artist.guestSpot.shopId}`}>{artist.guestSpot.shopName}</Link>, {formatDate(artist.guestSpot.startDate, { month: 'short', day: 'numeric' })} – {formatDate(artist.guestSpot.endDate, { month: 'short', day: 'numeric' })}
                </p>
              </div>
            )}
            {artist.bio && <p className="mt-4 text-gray-700 dark:text-gray-300 whitespace-pre-line">{artist.bio}</p>}
            {socials.length > 0 && (
              <div className="flex gap-3 mt-4">
                {socials.map(({ href, Icon, label }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="text-brand-gray hover:text-brand-primary"><Icon className="w-6 h-6" /></a>
                ))}
              </div>
            )}
            {!isSelf && (
              <div className="grid gap-2 mt-6">
                {settings.features.clientBooking && user?.role !== 'shop-owner' && user?.role !== 'admin' && (
                  <Button size="lg" onClick={startBooking}><CalendarIcon className="w-5 h-5" /> Request a booking</Button>
                )}
                {settings.features.messaging && (
                  <Button variant="outline" onClick={message} loading={messaging}><ChatIcon className="w-5 h-5" /> Message</Button>
                )}
              </div>
            )}
            {isSelf && (
              <Button variant="outline" block className="mt-6" onClick={() => navigate('/dashboard?tab=profile')}>Edit my profile</Button>
            )}
          </Card>

          {artist.services.length > 0 && (
            <Card>
              <h2 className="font-bold text-lg mb-3">Services</h2>
              <ul className="space-y-3">
                {artist.services.map(s => (
                  <li key={s.id} className="flex justify-between gap-4">
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-xs text-brand-gray">~{s.duration}h{s.description ? ` · ${s.description}` : ''}</p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className="font-bold text-brand-primary">from {dollars(s.price)}</p>
                      <p className="text-xs text-brand-gray">{dollars(s.deposit)} deposit</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {hasHours && (
            <Card>
              <h2 className="font-bold text-lg mb-3">Hours</h2>
              <ul className="text-sm space-y-1">
                {workingDays.map(({ day, slots }) => (
                  <li key={day} className="flex justify-between">
                    <span className="text-brand-gray">{day}</span>
                    <span>{slots.length ? slots.map(s => `${fmtTime(s.start)}–${fmtTime(s.end)}`).join(', ') : 'Closed'}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {user && !isSelf && (
            <button onClick={() => setReporting(true)} className="text-xs text-brand-gray hover:text-red-500 flex items-center gap-1">
              <FlagIcon className="w-4 h-4" /> Report this profile
            </button>
          )}
        </div>

        <div className="lg:col-span-2 space-y-8">
          <section>
            <h2 className="font-bold text-xl mb-4">Portfolio</h2>
            {artist.portfolio.length === 0 ? (
              <Card><EmptyState title="No portfolio images yet" /></Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {artist.portfolio.map((img, i) => (
                  <button key={img.url} onClick={() => setLightbox(i)} className="relative aspect-square overflow-hidden rounded-xl group bg-gray-200 dark:bg-gray-800">
                    <img src={img.url} alt={img.caption || `Tattoo by ${artist.name}`} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {settings.features.reviews && (
            <section>
              <h2 className="font-bold text-xl mb-4">Reviews</h2>
              {artist.reviews.length === 0 ? (
                <Card><EmptyState title="No reviews yet">Reviews appear here after completed sessions.</EmptyState></Card>
              ) : (
                <div className="space-y-3">
                  {artist.reviews.map(r => (
                    <Card key={r.id}>
                      <div className="flex justify-between items-center gap-3">
                        <span className="font-semibold">{r.authorName}</span>
                        <StarRating value={r.rating} size="w-4 h-4" />
                      </div>
                      {r.text && <p className="mt-2 text-gray-700 dark:text-gray-300">{r.text}</p>}
                      <p className="text-xs text-brand-gray mt-2">{timeAgo(r.createdAt)}</p>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {booking && <BookingRequestModal artist={artist} onClose={() => setBooking(false)} />}
      {reporting && <ReportModal targetType="user" targetId={artist.id} label={artist.name} onClose={() => setReporting(false)} />}
      {lightbox !== null && <Lightbox images={artist.portfolio} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
};
