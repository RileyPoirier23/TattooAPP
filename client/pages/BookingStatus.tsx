// A single booking request, reachable by the client (account or private guest link) — check status and pay.
import React, { useState } from 'react';
import { api, errorMessage } from '../api';
import { useLocation, Link } from '../router';
import { useStore } from '../store';
import { ClientRequestCard, ArtistRequestCard } from '../components/BookingCards';
import { Avatar, Button, Card, EmptyState, ErrorBox, Notice, PageLoader, useApi } from '../components/ui';
import { ArrowLeftIcon } from '../components/Icons';
import type { GuestBookingView } from '../../shared/types';

export const BookingStatusPage: React.FC<{ id: string }> = ({ id }) => {
  const { query } = useLocation();
  const token = query.get('token') || undefined;
  const user = useStore(s => s.user);
  const version = useStore(s => s.bookingsVersion);
  const { data, error, loading, reload } = useApi<GuestBookingView>(`/booking-requests/${id}${token ? `?token=${encodeURIComponent(token)}` : ''}`, [version]);
  const toast = useStore(s => s.toast);
  const openAuth = useStore(s => s.openAuth);
  const [claiming, setClaiming] = useState(false);

  if (error && !/not found/i.test(error)) return <ErrorBox message={error} onRetry={reload} />;
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
          <h1 className="text-2xl font-display">Your booking with {data.artist.name}</h1>
          <p className="text-brand-gray">{data.artist.city} · <Link to={`/artists/${data.artist.id}`} className="text-brand-primary underline underline-offset-2">View profile</Link></p>
        </div>
      </div>
      {data.request.isGuest && token && !isArtist && (
        <Notice>
          {user && (user.role === 'client' || user.role === 'dual' || user.role === 'artist') ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span>Add this booking to your account to keep everything in one place and message {data.artist.name}.</span>
              <Button
                size="sm"
                loading={claiming}
                onClick={async () => {
                  setClaiming(true);
                  try {
                    await api.post(`/booking-requests/${id}/claim`, { token });
                    toast('Added to your account.');
                    reload();
                  } catch (err) {
                    toast(errorMessage(err), 'error');
                  } finally {
                    setClaiming(false);
                  }
                }}
              >
                Add to my account
              </Button>
            </div>
          ) : !user ? (
            <span>
              Want to message {data.artist.name} or keep track of your bookings?{' '}
              <button className="font-semibold underline" onClick={() => openAuth('register')}>Create a free account</button> (or{' '}
              <button className="font-semibold underline" onClick={() => openAuth('login')}>log in</button>), then come back to this link to add the booking.
            </span>
          ) : null}
        </Notice>
      )}
      {isArtist ? (
        <ArtistRequestCard request={data.request} onChanged={reload} />
      ) : (
        <ClientRequestCard request={data.request} token={token} onChanged={reload} />
      )}
      {!user && <p className="text-xs text-center text-brand-gray">Keep this link private. Anyone with it can view and manage this booking.</p>}
    </div>
  );
};
