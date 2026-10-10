// Pro plan: subscribe (card on file, renews monthly), cancel / resume, update card.
import React, { useState } from 'react';
import { api, errorMessage } from '../api';
import { useStore } from '../store';
import { dollars, formatDate } from '../lib/format';
import { SquareCardForm } from './SquareCardForm';
import { Badge, Button, Card, Modal } from './ui';
import { CheckIcon, SparklesIcon } from './Icons';
import type { Me } from '../../shared/types';

export const ProPlanCard: React.FC<{ me: Me }> = ({ me }) => {
  const settings = useStore(s => s.config!.settings);
  const setUser = useStore(s => s.setUser);
  const toast = useStore(s => s.toast);
  const [cardModal, setCardModal] = useState<'subscribe' | 'update' | null>(null);
  const [busy, setBusy] = useState(false);
  const sub = me.subscription;
  const price = dollars(settings.proMonthlyPrice);

  const call = async (url: string, message: string) => {
    setBusy(true);
    try {
      const { user } = await api.post<{ user: Me }>(url);
      setUser(user);
      toast(message);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const perks = [
    `No ${settings.depositFeePercent}% booking fee for your clients on deposits`,
    'Pro badge on your profile',
    'Priority placement as the platform grows',
    'Cancel any time',
  ];

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-brand-secondary/20 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <SparklesIcon className="w-8 h-8 text-brand-secondary" />
          <h2 className="text-2xl font-extrabold">{settings.siteName} Pro</h2>
          {sub.isPro && <Badge tone="purple">Active</Badge>}
        </div>
        <p className="text-3xl font-black">{price}<span className="text-base font-medium text-brand-gray">/month</span></p>
        <ul className="mt-4 space-y-2">
          {perks.map(p => (
            <li key={p} className="flex items-center gap-2 text-sm"><CheckIcon className="w-5 h-5 text-emerald-500" />{p}</li>
          ))}
        </ul>

        <div className="mt-6 space-y-3">
          {sub.isPro ? (
            <>
              <p className="text-sm">
                {sub.proUntil
                  ? sub.autoRenew
                    ? <>Renews on <strong>{formatDate(sub.proUntil)}</strong>{sub.cardLabel && <> using {sub.cardLabel}</>}.</>
                    : <>Your plan ends on <strong>{formatDate(sub.proUntil)}</strong> and won't renew.</>
                  : 'Your Pro plan was granted by the site admin.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {sub.proUntil && sub.autoRenew && (
                  <Button variant="outline" loading={busy} onClick={() => window.confirm('Cancel auto-renewal? You keep Pro until the end of the current month.') && call('/me/subscription/cancel', 'Auto-renew turned off.')}>
                    Cancel plan
                  </Button>
                )}
                {sub.proUntil && !sub.autoRenew && (sub.cardLabel ? (
                  <Button loading={busy} onClick={() => call('/me/subscription/resume', 'Auto-renew is back on.')}>Resume plan</Button>
                ) : (
                  <Button onClick={() => setCardModal('update')}>Add card to resume</Button>
                ))}
                {sub.proUntil && <Button variant="ghost" onClick={() => setCardModal('update')}>Update card</Button>}
              </div>
            </>
          ) : (
            <Button size="lg" onClick={() => setCardModal('subscribe')}><SparklesIcon className="w-5 h-5" /> Upgrade for {price}/month</Button>
          )}
        </div>
      </div>
      {cardModal && (
        <Modal title={cardModal === 'subscribe' ? `Upgrade to Pro — ${price}/month` : 'Update your card'} onClose={() => setCardModal(null)} size="md">
          <SquareCardForm
            buttonLabel={cardModal === 'subscribe' ? `Pay ${price} & upgrade` : 'Save card'}
            note={cardModal === 'subscribe' ? `You'll be charged ${price} today and every month until you cancel. Card payments are processed by Square.` : undefined}
            onToken={async (sourceId, idempotencyKey) => {
              const { user } = await api.post<{ user: Me }>('/me/subscription', { sourceId, idempotencyKey });
              setUser(user);
              toast(cardModal === 'subscribe' ? "You're on Pro! 🎉" : 'Card updated.');
              setCardModal(null);
            }}
          />
        </Modal>
      )}
    </Card>
  );
};
