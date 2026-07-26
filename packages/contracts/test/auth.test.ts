import { describe, expect, it } from 'vitest';
import { UsernameSchema } from '../src/schemas/index';

describe('UsernameSchema', () => {
  it.each(['abc', 'player_10', 'a'.repeat(20)])('accepts %s', (username) => expect(UsernameSchema.safeParse(username).success).toBe(true));
  it.each(['ab', 'a'.repeat(21), 'Upper', 'hyphen-name', 'space name', 'кирилл'])('rejects %s', (username) => expect(UsernameSchema.safeParse(username).success).toBe(false));
});
