export class BudgetExhaustedError extends Error {
  constructor() {
    super('Insufficient credits. Visit billing to top up.');
    this.name = 'BudgetExhaustedError';
  }
}

export class ModelNotAvailableError extends Error {
  constructor(modelName: string) {
    super(`Model ${modelName} is not available on your plan.`);
    this.name = 'ModelNotAvailableError';
  }
}

export class RateLimitedError extends Error {
  constructor(public retryAfterSeconds: number) {
    super(`Too many requests. Retry in ${retryAfterSeconds}s.`);
    this.name = 'RateLimitedError';
  }
}

export class CredentialExpiredError extends Error {
  constructor() {
    super('LLM credentials expired. Refreshing...');
    this.name = 'CredentialExpiredError';
  }
}

export class ProviderUnavailableError extends Error {
  constructor() {
    super('All LLM providers are busy. Retry in a moment.');
    this.name = 'ProviderUnavailableError';
  }
}

const LITELLM_ERROR_MAP: Array<{ pattern: RegExp; factory: (match: RegExpMatchArray) => Error }> = [
  { pattern: /exceeded budget/i, factory: () => new BudgetExhaustedError() },
  { pattern: /model not found/i, factory: (m) => new ModelNotAvailableError(m[1] || 'unknown') },
  { pattern: /rate limit exceeded.*retry in (\d+)/i, factory: (m) => new RateLimitedError(Number(m[1])) },
  { pattern: /invalid api key/i, factory: () => new CredentialExpiredError() },
  { pattern: /no available provider/i, factory: () => new ProviderUnavailableError() },
];

export function mapLiteLLMError(status: number, body: string): Error {
  for (const { pattern, factory } of LITELLM_ERROR_MAP) {
    const match = body.match(pattern);
    if (match) return factory(match);
  }
  return new Error(`LiteLLM error (${status}): ${body.slice(0, 200)}`);
}
