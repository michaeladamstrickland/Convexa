// Guardrails: TokenBucket (RPS), CircuitBreaker, DailyBudget (in-cents)
import dotenv from 'dotenv';
dotenv.config();

let _db = null; // better-sqlite3 instance injected by init

function envInt(name, def) {
  const v = process.env[name];
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// Token bucket for simple RPS throttling
class TokenBucket {
  constructor({ capacity, refillPerSec }) {
    this.capacity = Math.max(1, capacity);
    this.tokens = this.capacity;
    this.refillPerSec = Math.max(1, refillPerSec);
    this._timer = setInterval(() => {
      this.tokens = Math.min(this.capacity, this.tokens + this.refillPerSec);
    }, 1000);
    this._timer.unref?.();
  }
  async take(n = 1) {
    const need = Math.max(1, n);
    while (this.tokens < need) {
      await new Promise(r => setTimeout(r, 50));
    }
    this.tokens -= need;
  }
  snapshot() {
    return { capacity: this.capacity, tokens: this.tokens, refillPerSec: this.refillPerSec };
  }
}

// Rolling error-rate circuit breaker
class CircuitBreaker {
  constructor({ threshold = 0.3, min = 30, halfOpenMs = 60000 }) {
    this.threshold = threshold;
    this.min = min;
    this.halfOpenMs = halfOpenMs;
    this.state = 'closed'; // closed | open | half
    this.buf = []; // boolean outcomes
    this.nextProbeAt = 0;
    this._halfProbeInFlight = false; // allow exactly one probe during half-open
  }
  _errRatio() {
    const total = this.buf.length;
    const ok = this.buf.filter(Boolean).length;
    const err = total - ok;
    const ratio = total > 0 ? err / total : 0;
    return { ok, err, total, ratio };
  }
  allow() {
    if (this.state === 'closed') return true;
    const now = Date.now();
    if (this.state === 'open') {
      if (now >= this.nextProbeAt) {
        this.state = 'half';
        if (this._halfProbeInFlight) return false;
        this._halfProbeInFlight = true;
        return true; // allow a single probe
      }
      return false;
    }
    // half-open: allow only one in-flight probe
    if (this._halfProbeInFlight) return false;
    this._halfProbeInFlight = true;
    return true;
  }
  record(ok) {
    this.buf.push(!!ok);
    if (this.buf.length > 200) this.buf.shift();
    const { total, ratio } = this._errRatio();
    if (this.state === 'closed') {
      if (total >= this.min && ratio >= this.threshold) {
        this.state = 'open';
        this.nextProbeAt = Date.now() + this.halfOpenMs;
      }
    } else if (this.state === 'half') {
      if (ok) {
        this.state = 'closed';
        this.buf.length = 0;
        this._halfProbeInFlight = false;
      } else {
        this.state = 'open';
        this.nextProbeAt = Date.now() + this.halfOpenMs;
        this._halfProbeInFlight = false;
      }
    }
  }
  snapshot() {
    const { ok, err, total, ratio } = this._errRatio();
    return { state: this.state, ok, err, total, errRatio: Number(ratio.toFixed(3)), nextProbeAt: this.nextProbeAt };
  }
}

// Daily budget tracker (in cents)
class DailyBudget {
  constructor({ capCents }) { this.capCents = Math.max(0, capCents); this.spentCents = 0; this._loadToday(); }
  _loadToday() {
    if (!_db) return; // tolerant init
    try {
      // Prefer cost_cents; fallback to cost
      const cols = _db.prepare('PRAGMA table_info(provider_calls)').all().map(c => c.name);
      let cents = 0;
      if (cols.includes('cost_cents')) {
        const row = _db.prepare("SELECT IFNULL(SUM(cost_cents),0) c FROM provider_calls WHERE date(created_at)=date('now')").get();
        cents = row?.c || 0;
      } else {
        const row = _db.prepare("SELECT IFNULL(SUM(cost),0) c FROM provider_calls WHERE date(created_at)=date('now')").get();
        cents = Math.round(100 * (row?.c || 0));
      }
      this.spentCents = cents;
    } catch (_) { this.spentCents = 0; }
  }
  add(cents) { this.spentCents += Math.max(0, Number(cents) || 0); }
  remaining() { return Math.max(0, this.capCents - this.spentCents); }
  atCap() { return this.capCents > 0 && this.spentCents >= this.capCents; }
  snapshot() { return { capCents: this.capCents, spentCents: this.spentCents, remainingCents: this.remaining() }; }
}

// Singletons
const RPS = envInt('SKIP_TRACE_RPS', 4);
const breaker = new CircuitBreaker({
  threshold: Number(process.env.CIRCUIT_BREAKER_ERROR_RATE || 0.3),
  min: envInt('CIRCUIT_MIN_SAMPLES', 30),
  halfOpenMs: envInt('CIRCUIT_HALF_OPEN_MS', 60000)
});
const bucket = new TokenBucket({ capacity: RPS, refillPerSec: RPS });
let budget = new DailyBudget({ capCents: Math.round(100 * Number(process.env.SKIP_TRACE_DAILY_BUDGET_USD || 0)) });

export function initGuardrails(db) {
  _db = db;
  budget = new DailyBudget({ capCents: Math.round(100 * Number(process.env.SKIP_TRACE_DAILY_BUDGET_USD || 0)) });
  budget._loadToday(); // Reload spentCents after db is available
}

export function guardrailsSnapshot() {
  return { breaker: breaker.snapshot(), budget: budget.snapshot(), rps: RPS, bucket: bucket.snapshot() };
}

export { bucket as tokenBucket, breaker as circuitBreaker, budget as dailyBudget, TokenBucket, CircuitBreaker, DailyBudget };
