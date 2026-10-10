// A single booking request, reachable by the client (account or private guest link) — check status and pay.
import React from 'react';
import { useLocation, Link } from '../router';
import { useStore } from '../store';
import { ClientRequestCard, ArtistRequestCard } from '../components/BookingCards';
import { Avatar, Card, EmptyState, ErrorBox, PageLoader, useApi } from '../components/ui';
import { ArrowLeftIcon } from '../components/Icons';
import type { GuestBookingView } from '../../shared/types';

export const BookingStatusPage: React.FC<{ id: string }> = ({ id }) => {
  const { query } = useLocation();
  const token = query.get('token') || undefined;
  const user = useStore(s => s.user);
  const version = useStore(s => s.bookingsVersion);
  const { data, error, loading, reload } = useApi<GuestBookingView>(`/booking-requests/${id}${token ? `?token=${encodeURIComponent(token)}` : ''}`, [version]);

  if (error) {
    return (
      <Card className="max-w-md mx-auto mt-10">
        <EmptyState title="Booking not found">
          This link may be incomplete. Use the full link from your confirmation email{user ? '' : ', or log in if you booked with an account'}.
        </EmptyState>
      </Card>
    );
  }
  if (loading || !data) return <PageLoader />;
  const isArtist = user?.id === data.request.artistId;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {user && (
        <Link to={isArtist ? '/dashboard' : '/bookings'} className="inline-flex items-center gap-1 text-sm text-brand-gray hover:text-brand-primary">
          <ArrowLeftIcon className="w-4 h-4" /> {isArtist ? 'Dashboard' : 'My bookings'}
        </Link>
      )}
      <div className="flex items-center gap-4">
        <Avatar name={data.artist.name} url={data.artist.avatarUrl} size="lg" />
        <div>
          <h1 className="text-2xl font-extrabold">Your booking with {data.artist.name}</h1>
          <p className="text-brand-gray">{data.artist.city} · <Link to={`/artists/${data.artist.id}`} className="text-brand-primary hover:underline">View profile</Link></p>
        </div>
      </div>
      {isArtist ? (
        <ArtistRequestCard request={data.request} onChanged={reload} />
      ) : (
        <ClientRequestCard request={data.request} token={token} onChanged={reload} />
      )}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!user && <p className="text-xs text-center text-brand-gray">Keep this link private — anyone with it can view and manage this booking.</p>}
    </div>
  );
};
