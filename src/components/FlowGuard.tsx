import { Link } from 'react-router-dom';
import { CalendarX2 } from 'lucide-react';
import { EmptyState } from '../common/ui';
import { useBookingFlow } from '../context/BookingFlowContext';
import { countsOf, type SearchCriteria } from '../lib/search';
import { passengersSummary } from '../lib/format';
import { ItineraryFlight } from './Itinerary';

export function FlowExpired() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <EmptyState
        icon={<CalendarX2 className="h-7 w-7" />}
        title="No booking in progress"
        description="Your booking session has ended or no flight has been selected yet. Start a new search to continue."
        action={
          <Link to="/" className="btn-primary">
            Search flights
          </Link>
        }
      />
    </div>
  );
}

/** Sidebar summary of the trip being booked. */
export function TripSummary({ criteria }: { criteria: SearchCriteria }) {
  const { outbound, returnFlight } = useBookingFlow();
  return (
    <div className="card space-y-3 p-5">
      <h2 className="text-base font-semibold">Your trip</h2>
      {outbound && <ItineraryFlight direction="OUTBOUND" flight={outbound} cabin={outbound.cabin} price={outbound.price} />}
      {returnFlight && <ItineraryFlight direction="RETURN" flight={returnFlight} cabin={returnFlight.cabin} price={returnFlight.price} />}
      <p className="text-sm text-ink-muted">{passengersSummary(countsOf(criteria))}</p>
    </div>
  );
}
