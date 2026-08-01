import { watermarkForStatus } from './doc-layout';

/*
  The watermark is Cyrillic because the documents are.

  «где то лотинча где то кирил» — it printed TASDIQLANMAGAN in Latin across the middle of every page
  of an otherwise Uzbek-Cyrillic form, at 12mm bold and 45°, on all 22 documents and on the frozen
  signed copies too. It is the most visible piece of text we put on a page, and it was the one in
  the wrong alphabet.

  None of these strings come from the reference workbook — the watermark is ours — so nothing about
  Excel fidelity changes with them.
*/
describe('watermarkForStatus', () => {
  it('is grey ТАСДИҚЛАНМАГАН while under review', () => {
    expect(watermarkForStatus('MODERATION')).toEqual({ text: 'ТАСДИҚЛАНМАГАН', color: '#9ca3af' });
    expect(watermarkForStatus('DIRECTOR_REVIEW')).toEqual({ text: 'ТАСДИҚЛАНМАГАН', color: '#9ca3af' });
  });
  it('turns green ТАСДИҚЛАНГАН once the director signs (ADMIN_FINALIZE) and after finalize', () => {
    expect(watermarkForStatus('ADMIN_FINALIZE')).toEqual({ text: 'ТАСДИҚЛАНГАН', color: '#16a34a' });
    expect(watermarkForStatus('FINALIZED')).toEqual({ text: 'ТАСДИҚЛАНГАН', color: '#16a34a' });
  });
  it('is red for rejected / cancelled', () => {
    expect(watermarkForStatus('REJECTED')).toEqual({ text: 'РАД ЭТИЛГАН', color: '#dc2626' });
    expect(watermarkForStatus('CANCELLED')).toEqual({ text: 'БЕКОР ҚИЛИНГАН', color: '#dc2626' });
  });
  it('has no watermark for a draft', () => {
    expect(watermarkForStatus('DRAFT')).toBeNull();
  });

  // One alphabet, checked as a rule rather than four assertions — a fifth status added later has to
  // obey it too.
  it('every watermark that exists is Cyrillic', () => {
    for (const st of ['MODERATION', 'DIRECTOR_REVIEW', 'ADMIN_FINALIZE', 'FINALIZED', 'REJECTED', 'CANCELLED']) {
      expect(watermarkForStatus(st)!.text).toMatch(/^[Ѐ-ӿ ]+$/);
    }
  });
});
