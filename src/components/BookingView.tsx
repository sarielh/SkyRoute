import { Badge } from '../common/ui';
import type { BookingDTO } from '../shared';
import { ItineraryFlight, PassengerTable, PriceBreakdown } from './Itinerary';

export function StatusBadge({ status }: { status: BookingDTO['status'] }) {
  return status === 'CONFIRMED' ? <Badge tone="green">Confirmed</Badge> : <Badge tone="red">Cancelled</Badge>;
}

/** Full booking details: flights, passengers and price. */
export function BookingSections({ booking }: { booking: BookingDTO }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <section className="card p-5 sm:p-6" aria-labelledby="bk-flights">
          <h2 id="bk-flights" className="mb-4 text-lg font-semibold">
            Flights
          </h2>
          <div className="space-y-3">
            {booking.flights.map((f) => (
              <ItineraryFlight key={f.direction} direction={f.direction} flight={f.flight} cabin={booking.cabin} price={f.unitPrice} />
            ))}
          </div>
        </section>
        <section className="card p-5 sm:p-6" aria-labelledby="bk-pax">
          <h2 id="bk-pax" className="mb-4 text-lg font-semibold">
            Passengers
          </h2>
          <PassengerTable passengers={booking.passengers} />
        </section>
      </div>
      <aside className="lg:self-start">
        <section className="card p-5 sm:p-6" aria-labelledby="bk-price">
          <h2 id="bk-price" className="mb-4 text-lg font-semibold">
            Price details
          </h2>
          <PriceBreakdown pricing={booking.pricing} />
        </section>
      </aside>
    </div>
  );
}
