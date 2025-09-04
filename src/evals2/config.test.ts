import { describe, it, expect } from 'vitest';
import { ENABLE_EVALS2, BRAINTRUST_API_KEY } from '@/config';

describe('Evals2 Configuration', () => {
  it('tests that ENABLE_EVALS2 can be read from environment', () => {
    // This will be true if set in .env, false otherwise
    expect(typeof ENABLE_EVALS2).toBe('boolean');
    console.log('ENABLE_EVALS2 =', ENABLE_EVALS2);
  });
  
  it('tests that BRAINTRUST_API_KEY is available', () => {
    expect(typeof BRAINTRUST_API_KEY).toBe('string');
    const hasKey = BRAINTRUST_API_KEY.length > 0;
    console.log('BRAINTRUST_API_KEY is', hasKey ? 'configured' : 'not configured');
  });
});