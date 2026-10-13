export interface TripPlanLine {
  category: string;
  /** Planned amount in the trip's own currency. */
  amount: number;
}

export interface Trip {
  id?: number;
  name: string;
  /** First day, local midnight as ISO. */
  start: string;
  /** Last day (inclusive), local midnight as ISO. */
  end: string;
  /** Currency the plan is written in. Same as the base currency for domestic trips. */
  currency: string;
  /** Base-currency units per 1 trip-currency unit (1 when currency is the base). */
  rate: number;
  plan: TripPlanLine[];
  notes?: string;
}
