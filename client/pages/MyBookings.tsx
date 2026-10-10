// The logged-in user's bookings: tattoo appointments they requested and booths they rented.
import React, { useState } from 'react';
import { Link } from '../router';
import { isArtist, useStore } from '../store';
import { today } from '../lib/format';
import { BoothBookingCard, ClientRequestCard } from '../components/BookingCards';
import { Button, EmptyState, ErrorBox, PageHeader, PageLoader, Tabs, useApi } from '../components/ui';
import { CalendarIcon, StoreIcon } from '../components/Icons';
import type { MyBookings } from '../../shared/types';

export const MyBookingsPage: React.FC = () => {
  const user = useStore(s => s.user)!;
  const features = useStore(s => s.config!.settings.features);
  const version = useStore(s => s.bookingsVersion);
  const { data, error, loading, reload } = useApi<MyBookings>('/bookings', [version]);
  const artist = isArtist(user);
  const [tab, setTab] = useState<'tattoos' | 'booths'>(artist && user.role === 'artist' ? 'booths' : 'tattoos');

  if (user.role === 'shop-owner') {
    return (
      <EmptyState title="Your shop's rentals live on your shop dashboard">
        <Link to="/shop"><Button className="mt-3">Go to my shop</Button></Link>
      </EmptyState>
    );
  }
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (loading || !data) return <PageLoader />;

  const upcoming = data.asClient.filter(r => ['pending', 'approved'].includes(r.status));
  const past = data.asClient.filter(r => !['pending', 'approved'].includes(r.status));
  const boothsUpcoming = data.boothBookings.filter(b => b.endDate >= today() && ['unpaid', 'paid'].includes(b.status));
  const boothsPast = data.boothBookings.filter(b => !boothsUpcoming.includes(b));

  const tabs = [
    { id: 'tattoos', label: 'Tattoo appointments', count: data.asClient.filter(r => r.status === 'approved' && r.paymentStatus === 'unpaid').length },
    ...(artist && features.boothRental ? [{ id: 'booths', label: 'Guest spots', count: data.boothBookings.filter(b => b.status === 'unpaid').length }] : []),
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="My bookings"
        subtitle={artist ? 'Appointments you booked and booths you rented. Requests from your clients are in your dashboard.' : 'Track your requests, pay deposits and leave reviews.'}
        actions={artist ? <Link to="/dashboard"><Button variant="outline">Artist dashboard</Button></Link> : undefined}
      />
      {tabs.length > 1 && <Tabs tabs={tabs} active={tab} onChange={id => setTab(id as typeof tab)} className="mb-6" />}

      {tab === 'tattoos' && (
        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Upcoming & pending</h2>
            {upcoming.length === 0 ? (
              <EmptyState icon={<CalendarIcon />} title="No upcoming appointments">
                {features.clientBooking && <Link to="/artists" className="text-brand-primary">Find an artist</Link>}
              </EmptyState>
            ) : upcoming.map(r => <ClientRequestCard key={r.id} request={r} onChanged={reload} />)}
          </section>
          {past.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold">Past</h2>
              {past.map(r => <ClientRequestCard key={r.id} request={r} onChanged={reload} />)}
            </section>
          )}
        </div>
      )}

      {tab === 'booths' && (
        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Upcoming guest spots</h2>
            {boothsUpcoming.length === 0 ? (
              <EmptyState icon={<StoreIcon />} title="No upcoming guest spots">
                <Link to="/shops" className="text-brand-primary">Browse shops</Link>
              </EmptyState>
            ) : boothsUpcoming.map(b => <BoothBookingCard key={b.id} booking={b} as="artist" onChanged={reload} />)}
          </section>
          {boothsPast.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold">Past & cancelled</h2>
              {boothsPast.map(b => <BoothBookingCard key={b.id} booking={b} as="artist" onChanged={reload} />)}
            </section>
          )}
        </div>
      )}
    </div>
  );
};
