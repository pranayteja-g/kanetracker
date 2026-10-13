export interface TripPlanLine {
  category: string;
  /** Planned amount in the main (base) currency. */
  amount: number;
}

export interface Trip {
  id?: number;
  name: string;
  /** First day, local midnight as ISO. */
  start: string;
  /** Last day (inclusive), local midnight as ISO. */
  end: string;
  /** Local currency of the destination, shown as a converted hint. Same as base for domestic trips. */
  currency: string;
  /** Base-currency units per 1 trip-currency unit (1 when currency is the base). */
  rate: number;
  plan: TripPlanLine[];
  /** true once plan amounts are in the base currency (older trips had them in the trip currency). */
  planBase?: boolean;
  notes?: string;
}
