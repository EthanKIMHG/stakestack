import { config, log } from '../config';

/**
 * Hard ceilings per run. The token may be shared with other projects, so the
 * ingester must never be the reason another job gets 403'd. Everything that
 * talks to GitHub goes through `spend*`; exceeding a ceiling throws
 * BudgetExceeded and the run ends cleanly (state is still saved).
 */
export class BudgetExceeded extends Error {}

export class Budget {
  graphqlPoints = 0;
  restRequests = 0;        // 304s are NOT counted (GitHub does not charge them)
  restRequests304 = 0;
  remainingPoints: number | null = null;
  remainingRest: number | null = null;
  resetAtPoints: string | null = null;
  resetAtRest: string | null = null;

  spendGraphql(cost: number, remaining: number, resetAt: string) {
    this.graphqlPoints += cost; this.remainingPoints = remaining; this.resetAtPoints = resetAt;
    if (this.graphqlPoints > config.budget.graphqlPointsPerRun) throw new BudgetExceeded(`GraphQL budget exceeded: ${this.graphqlPoints} > ${config.budget.graphqlPointsPerRun}`);
    if (remaining < config.budget.minRemainingPoints) throw new BudgetExceeded(`GraphQL remaining ${remaining} below floor ${config.budget.minRemainingPoints} (resets ${resetAt})`);
  }

  spendRest(status: number, headers: Headers) {
    const remaining = Number(headers.get('x-ratelimit-remaining') ?? NaN);
    const reset = headers.get('x-ratelimit-reset');
    if (!Number.isNaN(remaining)) this.remainingRest = remaining;
    if (reset) this.resetAtRest = new Date(Number(reset) * 1000).toISOString();
    if (status === 304) { this.restRequests304 += 1; return; }
    this.restRequests += 1;
    if (this.restRequests > config.budget.restRequestsPerRun) throw new BudgetExceeded(`REST budget exceeded: ${this.restRequests} > ${config.budget.restRequestsPerRun}`);
    if (!Number.isNaN(remaining) && remaining < config.budget.minRemainingRest) throw new BudgetExceeded(`REST remaining ${remaining} below floor ${config.budget.minRemainingRest}`);
  }

  /** Before a GraphQL batch, check that the worst case still fits. */
  canAffordGraphql(estimatedCost: number): boolean {
    return this.graphqlPoints + estimatedCost <= config.budget.graphqlPointsPerRun;
  }

  report() {
    const r = { graphqlPoints: this.graphqlPoints, remainingPoints: this.remainingPoints, restRequests: this.restRequests, rest304: this.restRequests304, remainingRest: this.remainingRest };
    log.info('github budget', r);
    return r;
  }
}
