// Lets a logged-in user flag a user, shop, booking or review for the admin.
import React, { useState } from 'react';
import { api, errorMessage } from '../api';
import { useStore } from '../store';
import { Button, Modal, Textarea } from './ui';

export const ReportModal: React.FC<{ targetType: 'user' | 'booking' | 'shop' | 'review'; targetId: string; label: string; onClose: () => void }> = ({
  targetType, targetId, label, onClose,
}) => {
  const toast = useStore(s => s.toast);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post('/reports', { targetType, targetId, reason });
      toast('Thanks. Our team will review this.');
      onClose();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Report ${label}`}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={submit} loading={busy} disabled={reason.trim().length < 5}>Send report</Button>
        </>
      }
    >
      <Textarea label="What's the problem?" value={reason} onChange={e => setReason(e.target.value)} rows={5} placeholder="Tell us what happened. Reports are only seen by the site admin." maxLength={2000} />
    </Modal>
  );
};
