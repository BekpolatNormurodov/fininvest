import { phoneToLogin, generatePassword } from './collectors.module';

/*
  Collector credentials: the phone doubles as the unique login (digits only), and a blank password is
  filled by the generator.
*/

describe('phoneToLogin', () => {
  it('reduces any phone formatting to a canonical digit string', () => {
    expect(phoneToLogin('+998 90 123 45 67')).toBe('998901234567');
    expect(phoneToLogin('998-90-123-45-67')).toBe('998901234567');
    expect(phoneToLogin('998901234567')).toBe('998901234567');
  });
});

describe('generatePassword', () => {
  it('is 6 characters from the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword();
      expect(pw).toHaveLength(6);
      expect(pw).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });
});
