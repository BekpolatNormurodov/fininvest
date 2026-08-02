import { workSessionDuration, formatDuration } from '@credit-core/shared';

describe('workSessionDuration', () => {
  it('is null while the shift is open', () => {
    expect(workSessionDuration('2026-08-02T08:00:00.000Z', null)).toBeNull();
  });
  it('is whole minutes between check-in and check-out', () => {
    expect(workSessionDuration('2026-08-02T08:00:00.000Z', '2026-08-02T10:15:00.000Z')).toBe(135);
  });
  it('never goes negative on a clock skew', () => {
    expect(workSessionDuration('2026-08-02T10:00:00.000Z', '2026-08-02T09:59:00.000Z')).toBe(0);
  });
});

describe('formatDuration', () => {
  it('renders hours and minutes, or a dash while open', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(45)).toBe('45 daq');
    expect(formatDuration(60)).toBe('1 soat');
    expect(formatDuration(135)).toBe('2 soat 15 daq');
  });
});
