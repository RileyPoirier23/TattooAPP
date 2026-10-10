// Landing page: admin-editable hero + about, featured artists and shops.
import React from 'react';
import { Link, navigate } from '../router';
import { useStore } from '../store';
import { Markdown } from '../lib/markdown';
import { Button, Card, useApi } from '../components/ui';
import { ArrowRightIcon, CalendarIcon, CashIcon, ChatIcon, StoreIcon } from '../components/Icons';
import { ArtistCard } from './Artists';
import { ShopCard } from './Shops';
import type { PublicArtist, Shop } from '../../shared/types';

export const HomePage: React.FC = () => {
  const s = useStore(st => st.config!.settings);
  const user = useStore(st => st.user);
  const openAuth = useStore(st => st.openAuth);
  const artists = useApi<PublicArtist[]>(s.features.clientBooking ? '/artists' : null);
  const shops = useApi<Shop[]>(s.features.boothRental ? '/shops' : null);

  return (
    <div>
      <section className="relative overflow-hidden">
        {s.heroImageUrl && (
          <>
            <img src={s.heroImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-brand-light dark:to-brand-dark" />
          </>
        )}
        {!s.heroImageUrl && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-40 -left-32 w-[32rem] h-[32rem] rounded-full bg-brand-primary/20 blur-3xl" />
            <div className="absolute -bottom-40 -right-32 w-[32rem] h-[32rem] rounded-full bg-brand-secondary/20 blur-3xl" />
          </div>
        )}
        <div className="relative container mx-auto px-4 py-20 md:py-32 text-center">
          <h1 className={`text-5xl md:text-7xl font-black tracking-tighter leading-[1.05] ${s.heroImageUrl ? 'text-white' : 'text-brand-dark dark:text-white'}`}>
            {s.heroTitle}
            {s.heroHighlight && (
              <>
                <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-primary to-brand-secondary">{s.heroHighlight}</span>
              </>
            )}
          </h1>
          <p className={`max-w-2xl mx-auto mt-6 text-lg ${s.heroImageUrl ? 'text-gray-200' : 'text-brand-gray'}`}>{s.heroSubtitle}</p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            {s.features.clientBooking && (
              <Button size="lg" onClick={() => navigate('/artists')} className="w-full sm:w-auto group">
                Find an artist <ArrowRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
            )}
            {s.features.boothRental && (
              <Button size="lg" variant="outline" onClick={() => navigate('/shops')} className={`w-full sm:w-auto ${s.heroImageUrl ? 'text-white border-white/40 hover:bg-white/10' : ''}`}>
                Find a guest spot
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 space-y-20">
        <section className="grid gap-4 md:grid-cols-4">
          {[
            { Icon: CalendarIcon, title: 'Request a booking', text: 'Share your idea, size and placement, and pick a day that works.' },
            { Icon: ChatIcon, title: 'Chat with your artist', text: 'Send reference photos and finalize the design together.' },
            { Icon: CashIcon, title: 'Secure deposits', text: 'Lock in your appointment with a deposit paid safely online.' },
            { Icon: StoreIcon, title: 'Guest spots for artists', text: 'Rent a booth at a shop in a new city for a day or a month.' },
          ].map(({ Icon, title, text }) => (
            <Card key={title}>
              <Icon className="w-8 h-8 text-brand-primary mb-3" />
              <h3 className="font-bold">{title}</h3>
              <p className="text-sm text-brand-gray mt-1">{text}</p>
            </Card>
          ))}
        </section>

        {s.features.clientBooking && artists.data && artists.data.length > 0 && (
          <section>
            <div className="flex items-end justify-between mb-6">
              <h2 className="text-3xl font-extrabold tracking-tight">Featured artists</h2>
              <Link to="/artists" className="text-sm font-semibold text-brand-primary hover:underline">See all →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...artists.data].sort((a, b) => Number(b.portfolio.length > 0) - Number(a.portfolio.length > 0)).slice(0, 4).map(a => <ArtistCard key={a.id} artist={a} />)}
            </div>
          </section>
        )}

        {s.features.boothRental && shops.data && shops.data.length > 0 && (
          <section>
            <div className="flex items-end justify-between mb-6">
              <h2 className="text-3xl font-extrabold tracking-tight">Shops hosting guest artists</h2>
              <Link to="/shops" className="text-sm font-semibold text-brand-primary hover:underline">See all →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {shops.data.slice(0, 3).map(sh => <ShopCard key={sh.id} shop={sh} />)}
            </div>
          </section>
        )}

        {s.aboutText && (
          <section>
            <Card className="md:p-10">
              <h2 className="text-3xl font-extrabold tracking-tight mb-2">{s.aboutTitle}</h2>
              <Markdown text={s.aboutText} className="text-brand-gray max-w-3xl" />
            </Card>
          </section>
        )}

        {!user && (
          <section className="rounded-3xl bg-gradient-to-r from-brand-primary to-brand-secondary text-white p-8 md:p-12 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight">Are you a tattoo artist or shop?</h2>
            <p className="mt-2 text-white/90 max-w-xl mx-auto">Create a free profile to take bookings and deposits online, or list your booths for guest artists.</p>
            <button onClick={() => openAuth('register')} className="mt-6 inline-flex items-center justify-center font-semibold px-6 py-3 rounded-xl bg-white text-gray-900 hover:bg-white/90 transition">
              Join for free
            </button>
          </section>
        )}
      </div>
    </div>
  );
};
