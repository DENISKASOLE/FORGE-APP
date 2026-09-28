// Workers Free allows 50 subrequests per request (fetch, D1, R2 all count).
// Every migration call tracks what it spends and stops at 40, leaving
// headroom for anything a helper from another area does internally.
import { HttpError } from "../http";

export const SUBREQUEST_BUDGET = 40;

export class Budget {
  used = 0;

  constructor(readonly limit = SUBREQUEST_BUDGET) {}

  get remaining(): number {
    return this.limit - this.used;
  }

  canAfford(n: number): boolean {
    return this.remaining >= n;
  }

  use(n = 1): void {
    if (this.used + n > this.limit) {
      throw new HttpError(500, "Subrequest budget exceeded for this call", "budget_exceeded");
    }
    this.used += n;
  }
}
