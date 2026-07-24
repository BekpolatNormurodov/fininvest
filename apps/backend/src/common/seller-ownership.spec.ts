import { SellerKind, namesLikelySame, sellerOwnershipWarning } from '@credit-core/shared';

describe('namesLikelySame', () => {
  it('matches identical names ignoring case and punctuation', () => {
    expect(namesLikelySame('Исмоилов Бахром', 'исмоилов, бахром')).toBe(true);
  });

  it('matches initials against full given names when the surname agrees', () => {
    expect(namesLikelySame('Исмоилов Б А', 'Исмоилов Бахром Ахрор')).toBe(true);
  });

  it('rejects a different surname', () => {
    expect(namesLikelySame('Каримов Бахром', 'Исмоилов Бахром')).toBe(false);
  });

  it('is false when either name is empty', () => {
    expect(namesLikelySame('', 'Исмоилов Бахром')).toBe(false);
    expect(namesLikelySame('Исмоилов', '')).toBe(false);
  });
});

describe('sellerOwnershipWarning', () => {
  it('warns when an individual seller does not match the titled owner', () => {
    const w = sellerOwnershipWarning({
      sellerKind: SellerKind.INDIVIDUAL,
      sellerName: 'Каримов Анвар',
      assetOwnerName: 'Исмоилов Бахром',
    });
    expect(w).toContain('mos kelmasligi mumkin');
  });

  it('is silent when the individual seller matches the owner', () => {
    expect(
      sellerOwnershipWarning({
        sellerKind: SellerKind.INDIVIDUAL,
        sellerName: 'Исмоилов Б.',
        assetOwnerName: 'Исмоилов Бахром',
      }),
    ).toBeNull();
  });

  it('never checks a legal seller (dealer/developer sells via invoice/DDU)', () => {
    expect(
      sellerOwnershipWarning({
        sellerKind: SellerKind.LEGAL,
        sellerName: 'Namuna Motors',
        assetOwnerName: 'Boshqa kishi',
      }),
    ).toBeNull();
  });

  it('is silent when there is no owner to compare against', () => {
    expect(
      sellerOwnershipWarning({
        sellerKind: SellerKind.INDIVIDUAL,
        sellerName: 'Каримов Анвар',
        assetOwnerName: '',
      }),
    ).toBeNull();
  });
});
