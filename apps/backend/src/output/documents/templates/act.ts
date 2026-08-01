import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { moneyWithWordsCyr, dateToRuCyrillic } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { lineAgreementNo, DOC_DEFAULT_STYLE, DOC_PAGE_MARGINS } from '../doc-layout';
import { p, notaryBlock } from './_shared';
import { collateralDeclaredBlock, collateralAgreedTables, totalAgreedValue, shortName } from './_collateral';

/** "1 Июль 2026" (Russian month, no suffix) for the "...йилдаги" phrasing inside clauses. */
const ruBare = (d: Date): string => dateToRuCyrillic(d).replace(/\s*й\.$/, '');

/**
 * Акт согласования (ГАРОВ ПРЕДМЕТИНИНГ ҚИЙМАТИНИ КЕЛИШИШ ДАЛОЛАТНОМАСИ) — the collateral
 * valuation-agreement act, matching the Excel: title, date, the 3-party intro clause, the DECLARED
 * composition table + footnotes, the agreement clause, the AGREED value table (with залоговая
 * стоимость), the definition + total-value sentences, and the 1/2/3-тарафдан signatures. The 3rd
 * party (Гаровга қўювчи) appears only when the pledgor differs from the borrower.
 *
 * @param notary appends the notarial-attestation block.
 */
export function actTemplate(c: CaseDocData, notary = false): TDocumentDefinitions {
  const org = c.organization;
  const line = c.creditLine;
  const b = c.borrower;
  const borrowerName = b?.fullName ?? '—';
  const pledgorName = c.collaterals?.[0]?.owners?.[0]?.fullName ?? borrowerName;
  const samePerson = pledgorName === borrowerName;
  const contractNo = c.contractNumber ?? c.number ?? '—';
  const lineRefNo = lineAgreementNo(c);
  const dateBare = line?.lineDate ? ruBare(line.lineDate) : '—';
  const dateFull = line?.lineDate ? dateToRuCyrillic(line.lineDate) : '—';
  const creditAmount = line?.amountTotal ?? c.amount ?? null;
  const agreed = totalAgreedValue(c);

  // The Excel names the parties in short form ("TURAYEV Z.B.") inside the intro clause.
  const partiesClause = samePerson
    ? `«Қарз олувчи» ва «Гаровга қўювчи» (2 тараф) Ўзбекистон Республикаси фуқароси ${shortName(borrowerName)}`
    : `«Қарз олувчи» (2 тараф) Ўзбекистон Республикаси фуқароси ${shortName(borrowerName)} ва «Гаровга қўювчи» (3 тараф) Ўзбекистон Республикаси фуқароси ${shortName(pledgorName)}`;

  const signatureRow = (labelLeft: string, right: string): Content => ({
    columns: [
      { width: '*', text: labelLeft },
      { width: 'auto', text: right, alignment: 'right' },
    ],
    columnGap: 12,
    margin: [0, 2, 0, 0],
  });

  const signatures: Content[] = [
    { text: '1 - тарафдан:', bold: true, margin: [0, 16, 0, 2] },
    { text: org?.nameUpper ?? 'ММТ' },
    signatureRow('Ижрочи директори', `_______________ ${org?.directorShort ?? '—'}`),
    { text: '2 - тарафдан:', bold: true, margin: [0, 10, 0, 2] },
    signatureRow('Ўзбекистон Республикаси фуқароси', `_______________ ${shortName(borrowerName)}`),
  ];
  if (!samePerson) {
    signatures.push(
      { text: '3 - тарафдан:', bold: true, margin: [0, 10, 0, 2] },
      signatureRow('Ўзбекистон Республикаси фуқароси', `_______________ ${shortName(pledgorName)}`),
    );
  }

  return {
    defaultStyle: DOC_DEFAULT_STYLE,
    pageMargins: DOC_PAGE_MARGINS,
    content: [
      // NOTE: the reference sheet has NO org letterhead — the act opens with its title.
      // The Excel titles the valuation act "…ДАЛОЛАТНОМАСИ №1" — one act per case, not the contract №.
      { text: 'ГАРОВ ПРЕДМЕТИНИНГ ҚИЙМАТИНИ КЕЛИШИШ ДАЛОЛАТНОМАСИ №1', bold: true, alignment: 'center', fontSize: 12 },
      {
        columns: [
          { width: '*', text: 'Тошкент ш.' },
          { width: 'auto', text: dateFull, alignment: 'right' },
        ],
        margin: [0, 4, 0, 10],
      },
      p(
        `Ушбу далолатнома ${org?.nameUpper ?? 'ММТ'} (1 тараф) ижрочи директори ${org?.directorShort ?? '—'}, ` +
          `${partiesClause} иштирокида ва хабардорлигида 2 тарафга ${dateBare} йилдаги №${lineRefNo} сонли микромолиялаш линияси очиш ` +
          `тўғрисидаги Бош келишувига асосан ${moneyWithWordsCyr(creditAmount)} миқдоридаги микроқарз/микрокредит гаров ` +
          `таъминоти сифатида тақдим этилаётган қуйидаги мулкни гаров қийматини аниқлаш учун мазкур далолатномани туздик.`,
      ),
      p(`Микромолия линияси гаров таъминоти сифатида ${pledgorName}га тегишли қуйидаги мулк тақдим этилади:`),
      ...collateralDeclaredBlock(c),
      p(
        `Тарафлар келишувига кўра юқоридаги мулк ${org?.nameMixed ?? 'ММТ'} томонидан Қарз олувчи ва Гаровга кўювчи ` +
          `розилиги асосида ${moneyWithWordsCyr(agreed)} баҳоланди ва фуқаро ${shortName(borrowerName)} га ажратилаётган ` +
          `${dateBare} йилдаги №${lineRefNo} микромолиялаш линияси очиш тўғрисидаги Бош Келишувга асосан ` +
          `${moneyWithWordsCyr(creditAmount)} миқдоридаги кредит маблағлари гаров таъминоти сифатида гаровга олиш келишилди:`,
      ),
      ...collateralAgreedTables(c),
      p('Хусусан, гаров предметининг келишилган гаров қиймати деганда ушбу мол - мулк гаров сифатида тақдим этиладиган/қабул қилинадиган қиймат тушунилади.'),
      p(`Гаров предметининг келишилган гаров қиймати ${moneyWithWordsCyr(agreed)}ни ташкил қилади.`),
      { stack: signatures, unbreakable: true },
      ...(notary ? [notaryBlock(c)] : []),
    ],
  };
}
