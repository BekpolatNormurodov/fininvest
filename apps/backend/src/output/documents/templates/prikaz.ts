import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { dateToRuCyrillic } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { lineAgreementNo, DOC_DEFAULT_STYLE, DOC_PAGE_MARGINS } from '../doc-layout';
import { lineTerms, notaryBlock } from './_shared';
import { collateralBlock } from './_collateral';

/**
 * Приказ на сделку (buyruq) — the executive director's order allocating the microfinance line.
 * Uzbek Cyrillic, matching the Excel: order header, 5 numbered conditions (amounts spelled in
 * Cyrillic), then the collateral **value table** + footnotes (auto / real-estate), and the director's
 * signature. `notary=true` appends the notarial-attestation block.
 */
export function prikazTemplate(c: CaseDocData, notary = false): TDocumentDefinitions {
  const org = c.organization;
  const line = c.creditLine;
  const b = c.borrower;
  const director = org?.directorFull ?? 'Ижрочи директор';
  const contractNo = lineAgreementNo(c);
  const dateStr = line?.lineDate ? `${dateToRuCyrillic(line.lineDate)} йилдаги` : '—';

  return {
    defaultStyle: DOC_DEFAULT_STYLE,
    pageMargins: DOC_PAGE_MARGINS,
    content: [
      // NOTE: the reference sheet has NO org letterhead — the order opens with the org name.
      { text: org?.nameUpper ?? 'ММТ', alignment: 'center', bold: true },
      { text: 'Ижрочи директорининг', alignment: 'center', margin: [0, 2, 0, 2] },
      { text: `${dateStr} №${contractNo} БУЙРУҒИ`, alignment: 'center', bold: true, fontSize: 12, margin: [0, 0, 0, 12] },
      {
        text: `Мен, ${director}, ${org?.nameUpper ?? 'ММТ'} ижрочи директори, фуқаро ${b?.fullName ?? '—'}га қуйидаги шартларда микроқарз/микрокредит ажратилишини буюраман:`,
        alignment: 'justify',
        margin: [0, 0, 0, 8],
      },
      ...lineTerms(c),
      { text: '5. Микромолия линияси таъминоти:', margin: [0, 4, 0, 4] },
      ...collateralBlock(c),
      {
        columns: [
          { width: '*', stack: [{ text: org?.nameUpper ?? 'ММТ' }, { text: 'Ижрочи директори' }] },
          { width: 'auto', alignment: 'right', stack: [{ text: '\n' }, { text: org?.directorShort ?? director, bold: true }, { text: '_______________' }] },
        ],
        margin: [0, 24, 0, 0],
      },
      ...(notary ? [notaryBlock(c)] : []),
    ],
  };
}
