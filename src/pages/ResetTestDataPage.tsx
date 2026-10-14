import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { EmptyState, Modal } from '../common/ui';
import { useToast } from '../common/toast';
import { useBookingFlow } from '../context/BookingFlowContext';
import { clearAppStorage } from '../mock-api/store';

/** Clears this browser's SkyRoute bookings, seat changes and booking drafts. */
export function ResetTestDataPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const flow = useBookingFlow();
  const [confirming, setConfirming] = useState(false);

  const reset = () => {
    clearAppStorage();
    flow.reset();
    setConfirming(false);
    toast.success('Data reset', 'All bookings and booking drafts in this browser were removed.');
    navigate('/');
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <EmptyState
        icon={<RotateCcw className="h-7 w-7" />}
        title="Reset local data"
        description="Removes all bookings, cancellations and booking drafts stored in this browser and restores the original seat availability. Flight schedules are not affected."
        action={
          <button type="button" className="btn-danger" onClick={() => setConfirming(true)}>
            Reset data
          </button>
        }
      />
      <Modal
        open={confirming}
        title="Reset all local data?"
        onClose={() => setConfirming(false)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
              Keep my data
            </button>
            <button type="button" className="btn-danger" onClick={reset}>
              Yes, reset
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">This permanently deletes every booking made in this browser. This cannot be undone.</p>
      </Modal>
    </div>
  );
}
