// Payment dialogs for client deposits and booth rentals.
import React from 'react';
import { api } from '../api';
import { useStore } from '../store';
import { formatDate, formatDateTime, money } from '../lib/format';
import { SquareCardForm } from './SquareCardForm';
import { Modal } from './ui';
import type { BookingRequest, BoothBooking } from '../../shared/types';

export const PayDepositModal: React.FC<{ request: BookingRequest; token?: string; onClose: () => void; onPaid: () => void }> = ({ request, token, onClose, onPaid }) => {
  const toast = useStore(s => s.toast);
  const total = request.depositCents + request.feeCents;
  return (
    <Modal title="Pay your deposit" onClose={onClose} size="md">
      <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 mb-5 text-sm space-y-1.5">
        <p className="font-semibold text-base">{request.serviceName} with {request.artistName}</p>
        <p className="text-brand-gray">{formatDate(request.date)}</p>
        <div className="flex justify-between pt-2"><span>Deposit</span><span>{money(request.depositCents)}</span></div>
        {request.feeCents > 0 && <div className="flex justify-between"><span>Booking fee</span><span>{money(request.feeCents)}</span></div>}
        <div className="flex justify-between font-bold text-base border-t border-gray-200 dark:border-gray-700 pt-2"><span>Total</span><span>{money(total)}</span></div>
        <p className="text-xs text-brand-gray pt-1">The deposit is put towards the price of your tattoo.</p>
      </div>
      <SquareCardForm
        buttonLabel={`Pay ${money(total)}`}
        onToken={async (sourceId, idempotencyKey) => {
          await api.post(`/booking-requests/${request.id}/pay`, { sourceId, idempotencyKey, token });
          toast(`Deposit paid. You're booked.${useStore.getState().config?.emailReady ? ' A receipt is on its way to your email.' : ''}`);
          onPaid();
        }}
      />
    </Modal>
  );
};

export const PayBoothModal: React.FC<{ booking: BoothBooking; onClose: () => void; onPaid: () => void }> = ({ booking, onClose, onPaid }) => {
  const toast = useStore(s => s.toast);
  return (
    <Modal title="Pay for your booth" onClose={onClose} size="md">
      <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 mb-5 text-sm space-y-1.5">
        <p className="font-semibold text-base">{booking.boothName} at {booking.shopName}</p>
        <p className="text-brand-gray">
          {formatDate(booking.startDate)} → {formatDate(booking.endDate)} ({booking.days} day{booking.days > 1 ? 's' : ''})
        </p>
        <div className="flex justify-between font-bold text-base border-t border-gray-200 dark:border-gray-700 pt-2"><span>Total</span><span>{money(booking.totalCents)}</span></div>
        {booking.holdExpiresAt && <p className="text-xs text-brand-gray pt-1">Held for you until {formatDateTime(booking.holdExpiresAt)}.</p>}
      </div>
      <SquareCardForm
        buttonLabel={`Pay ${money(booking.totalCents)}`}
        onToken={async (sourceId, idempotencyKey) => {
          await api.post(`/booth-bookings/${booking.id}/pay`, { sourceId, idempotencyKey });
          toast('Booth paid. Your guest spot is confirmed.');
          onPaid();
        }}
      />
    </Modal>
  );
};
