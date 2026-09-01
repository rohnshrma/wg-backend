import { normalizeIndianMobile, toWhatsAppFormat } from '../src/utils/phone';

describe('normalizeIndianMobile', () => {
  it('accepts a bare 10-digit number', () => {
    expect(normalizeIndianMobile('9876543210')).toBe('9876543210');
  });

  it('strips a leading 91 country code', () => {
    expect(normalizeIndianMobile('919876543210')).toBe('9876543210');
  });

  it('strips a leading +91 with spaces', () => {
    expect(normalizeIndianMobile('+91 9876543210')).toBe('9876543210');
  });

  it('strips a leading 0 (STD-style)', () => {
    expect(normalizeIndianMobile('09876543210')).toBe('9876543210');
  });

  it('strips dashes and spaces', () => {
    expect(normalizeIndianMobile('+91-98765-43210')).toBe('9876543210');
  });

  it('rejects a number not starting with 6-9', () => {
    expect(normalizeIndianMobile('5876543210')).toBeNull();
  });

  it('rejects a garbage string', () => {
    expect(normalizeIndianMobile('not-a-phone')).toBeNull();
  });

  it('rejects the wrong number of digits', () => {
    expect(normalizeIndianMobile('98765')).toBeNull();
  });
});

describe('toWhatsAppFormat', () => {
  it('prefixes 91', () => {
    expect(toWhatsAppFormat('9876543210')).toBe('919876543210');
  });
});
