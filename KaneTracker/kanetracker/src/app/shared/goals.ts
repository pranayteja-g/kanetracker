export interface Contribution { id: string; amount: number; date: string }
export interface Goal {
  id: string; name: string; target: number; deadline?: string; tripId?: number; saved: Contribution[];
}
export interface GoalView { savedSum: number; target: number; left: number; pct: number; monthsLeft: number | null; perMonth: number | null; state: 'done' | 'on' | 'late' | 'open' }

const r2 = (n: number) => Math.round(n * 100) / 100;

/** `target` overrides goal.target (a trip-linked goal follows the trip's plan). Pure. */
export function viewGoal(g: Goal, now: Date, target = g.target, deadline = g.deadline): GoalView {
  const savedSum = r2(g.saved.reduce((s, c) => s + c.amount, 0));
  const left = r2(Math.max(0, target - savedSum));
  const pct = target > 0 ? Math.min(100, (savedSum / target) * 100) : 0;
  if (left <= 0 && target > 0) return { savedSum, target, left: 0, pct: 100, monthsLeft: null, perMonth: null, state: 'done' };
  if (!deadline) return { savedSum, target, left, pct, monthsLeft: null, perMonth: null, state: 'open' };
  const d = new Date(deadline);
  const months = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth()) + (d.getDate() >= now.getDate() ? 0 : -1);
  if (d.getTime() < now.getTime() || months < 1) return { savedSum, target, left, pct, monthsLeft: Math.max(0, months), perMonth: left, state: d.getTime() < now.getTime() ? 'late' : 'on' };
  return { savedSum, target, left, pct, monthsLeft: months, perMonth: r2(left / months), state: 'on' };
}
