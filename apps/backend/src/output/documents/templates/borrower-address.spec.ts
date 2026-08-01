import { DOC_REGISTRY } from '../registry';
import { borrowerAddress } from '../doc-layout';
import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';

/*
  «просто манзил болиши кере и прописку должен показывать.»

  The workbook gives the contract, the ходатайство, the бош келишув, the score report and the credit
  application one address cell — Д1!C20, the propiska — so «Манзил» carries the registered address
  and the анкета is the only form with two rows (Д2!D13 registered, Д2!D14 actual).

  Every site spelled the lookup as `regAddress ?? address ?? '—'`, which has two holes: `??` does not
  skip an empty string, so a cleared field printed «Манзил: » with the next label butted against it;
  and `actualAddress` was never in the chain, so a case holding only that printed «—».

  The sweep at the bottom is the part that matters. The templates were fixed one at a time before,
  from a hand-written list, and the list missed the APEX contract and the payment schedule — the two
  documents a client actually signs and takes away.
*/
describe('borrowerAddress', () => {
  it('prints the propiska, which is the cell the forms point at', () => {
    expect(borrowerAddress({ regAddress: 'Тошкент ш., Чилонзор 12', address: 'boshqa' })).toBe('Тошкент ш., Чилонзор 12');
  });

  it('falls through a blank rather than printing nothing', () => {
    expect(borrowerAddress({ regAddress: '', address: 'Наманган ш.' })).toBe('Наманган ш.');
    expect(borrowerAddress({ regAddress: '   ', address: 'Наманган ш.' })).toBe('Наманган ш.');
  });

  it('reaches the actual address when it is the only one the case holds', () => {
    expect(borrowerAddress({ regAddress: null, address: null, actualAddress: 'Андижон ш.' })).toBe('Андижон ш.');
  });

  it('says «—» when the case holds no address at all', () => {
    expect(borrowerAddress({})).toBe('—');
    expect(borrowerAddress(null)).toBe('—');
  });
});

describe('no document prints an empty «Манзил»', () => {
  // AVTO is in the list on purpose: it routes to the APEX contract, which a per-template list missed.
  const CASES = [
    { name: 'cash', product: undefined },
    { name: 'AVTO (APEX contract)', product: 'AVTO' },
  ];
  // Every way an address can go missing, including the ones `??` does not catch.
  const EMPTY = [
    { name: 'all null', v: { regAddress: null, address: null, actualAddress: null } },
    { name: 'blank string', v: { regAddress: '', address: '', actualAddress: '' } },
    { name: 'whitespace', v: { regAddress: '   ', address: '  ', actualAddress: ' ' } },
  ];

  for (const c of CASES) {
    for (const e of EMPTY) {
      it(`${c.name} · ${e.name}: every document says «—», never a bare label`, () => {
        for (const key of Object.keys(DOC_REGISTRY)) {
          const doc = mockCaseDoc({
            ...(c.product ? { product: c.product as never } : {}),
            borrower: e.v as never,
          });
          const t = flattenDocText(DOC_REGISTRY[key]!.build(doc));
          // «Манзил: » or «манзил: » with nothing before the next capitalised label.
          expect(t).not.toMatch(/[Мм]анзил:\s*(Паспорт|Тел|ЖШШИР|$)/);
          // The helper leaking as a function body — `${borrowerAddress}` instead of `${addressLine}`
          // typechecks and renders the source code into a signed contract.
          expect(t).not.toContain('function');
          expect(t).not.toContain('=>');
        }
      });
    }
  }

  it('carries the address into every form that has an address slot', () => {
    const ADDR = 'Тошкент ш., Чилонзор тумани, 12-уй';
    for (const key of ['contract', 'rklGen', 'petition', 'creditApplication', 'scoreReport', 'grafik', 'disbursement']) {
      expect(flattenDocText(DOC_REGISTRY[key]!.build(mockCaseDoc({ borrower: { regAddress: ADDR } })))).toContain(ADDR);
    }
    // The APEX contract is the AVTO/IPOTEKA form and has its own requisites block.
    expect(flattenDocText(DOC_REGISTRY['contract']!.build(mockCaseDoc({ product: 'AVTO' as never, borrower: { regAddress: ADDR } }))))
      .toContain(ADDR);
  });

  // Д2!D13 vs D14 — the анкета is the one form that must show both, and must not be collapsed.
  it('the анкета still shows the registered AND the actual address separately', () => {
    const t = flattenDocText(DOC_REGISTRY['clientProfile']!.build(
      mockCaseDoc({ borrower: { regAddress: 'ПРОПИСКА-МАНЗИЛ', actualAddress: 'ФАКТИК-МАНЗИЛ' } }),
    ));
    expect(t).toContain('ПРОПИСКА-МАНЗИЛ');
    expect(t).toContain('ФАКТИК-МАНЗИЛ');
  });
});
