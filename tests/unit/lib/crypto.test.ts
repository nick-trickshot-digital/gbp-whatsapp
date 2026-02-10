import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock the config before importing the module
vi.mock('../../../src/config/env.js', () => ({
  config: {
    TOKEN_ENCRYPTION_KEY: 'a'.repeat(64), // 32 bytes of 0xAA in hex
  },
}));

import { encrypt, decrypt } from '../../../src/lib/crypto.js';

describe('crypto', () => {
  it('should encrypt and decrypt a string roundtrip', () => {
    const plaintext = 'my-secret-refresh-token-abc123';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for the same plaintext (random IV)', () => {
    const plaintext = 'same-input-different-output';
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);

    expect(encrypted1).not.toBe(encrypted2);

    // But both should decrypt to the same value
    expect(decrypt(encrypted1)).toBe(plaintext);
    expect(decrypt(encrypted2)).toBe(plaintext);
  });

  it('should handle empty strings', () => {
    const encrypted = encrypt('');
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe('');
  });

  it('should handle unicode characters', () => {
    const plaintext = 'token-with-emoji-\u2705-and-accents-\u00E9';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should throw on invalid encrypted format', () => {
    expect(() => decrypt('not-valid-format')).toThrow();
  });

  it('should throw on tampered ciphertext', () => {
    const encrypted = encrypt('my-token');
    const parts = encrypted.split(':');
    // Tamper with the ciphertext
    parts[2] = 'AAAA' + parts[2].slice(4);
    expect(() => decrypt(parts.join(':'))).toThrow();
  });
});
