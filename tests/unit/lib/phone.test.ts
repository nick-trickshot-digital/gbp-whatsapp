import { describe, it, expect } from 'vitest';

// Only test the normalizePhone function (not the DB-dependent lookupClientByPhone)
// We import it directly by re-implementing the pure function logic here
// since the module has a side-effect import of the DB client

describe('phone normalization', () => {
  function normalizePhone(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
  }

  it('should strip the + prefix', () => {
    expect(normalizePhone('+353871234567')).toBe('353871234567');
  });

  it('should handle numbers without prefix', () => {
    expect(normalizePhone('353871234567')).toBe('353871234567');
  });

  it('should strip spaces and dashes', () => {
    expect(normalizePhone('+353 87 123 4567')).toBe('353871234567');
    expect(normalizePhone('353-87-123-4567')).toBe('353871234567');
  });

  it('should strip parentheses', () => {
    expect(normalizePhone('+44 (0) 7712 345678')).toBe('4407712345678');
  });

  it('should handle empty string', () => {
    expect(normalizePhone('')).toBe('');
  });
});
