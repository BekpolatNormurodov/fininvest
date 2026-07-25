import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  moneyWithWordsCyr, integerToUzbekWordsCyrillic, dateToRuCyrillic,
} from '../../../common/sum-to-words.util';
import { assetInsuranceLabelCyr, type LoanProduct } from '@credit-core/shared';
import { CaseDocData } from '../case-document.loader';
import { docTitle, shortDate, plainMoney, DOC_DEFAULT_STYLE, DOC_PAGE_MARGINS } from '../doc-layout';
import { autoDescription, realtyDescription, isAutoOnly } from './_collateral';
import { loanWord } from './_shared';

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** Number spelled in Cyrillic Uzbek words, capitalized (e.g. 33 → "Ўттиз уч"). */
const words = (n: number): string => cap(integerToUzbekWordsCyrillic(n));

/**
 * Микроқарз олиш учун АРИЗА — the borrower's loan application, matching the Excel «Кредитная заявка»:
 * borrower identity, activity & income, requested terms (amounts spelled in Cyrillic), the collateral
 * paragraph (auto/real-estate), the insurance-polis line (hidden when the case is auto-only), the
 * acceptless-withdrawal clause, the KATM/bureau/garov-reestr consent list, date and signature.
 */
export function creditApplicationTemplate(c: CaseDocData): TDocumentDefinitions {
  const org = c.organization;
  const line = c.creditLine;
  const tr = line?.tranches?.[0];
  const b = c.borrower;
  const emp = c.employment;
  const af = c.affordability;
  const monthlyIncome = af?.avgMonthlyIncome ?? af?.mainActivityIncome ?? null;

  const amount = line?.amountTotal ?? c.amount ?? null;
  const term = tr?.termMonths ?? line?.termMonths ?? c.termMonths ?? null;
  const ratePct = line?.interestRate != null ? Math.round(Number(line.interestRate) * 100) : null;
  const appDate = tr?.applicationDate ?? line?.lineDate ?? c.createdAt ?? null;
  const insuredSum = line?.insurance?.insuredSum ?? line?.amountPolis ?? null;

  const passport = [b?.passportSeries, b?.passportNumber ? `№${b.passportNumber}` : null].filter(Boolean).join(' ');
  const passportLine =
    `Паспорт маълумотлари: ${passport || '—'}` +
    `${b?.passportIssuer ? ` ${b.passportIssuer} томонидан` : ''}` +
    `${b?.passportIssueDate ? ` ${shortDate(b.passportIssueDate)} йилда берилган` : ''}.`;

  // The workbooks swap "Микроқарз"/"Микрокредит" throughout this form by product type.
  const lw = loanWord(c);
  const p = (text: string, top = 6): Content => ({ text, margin: [0, top, 0, 0] });

  // Collateral paragraphs (one bullet per pledged item).
  const collateralLines: Content[] = (c.collaterals ?? []).map((col) =>
    p(`- ${col.type === 'AUTO' ? autoDescription(col) : realtyDescription(col)}`),
  );

  const content: Content[] = [
    // NOTE: the reference sheet has NO org letterhead — it opens with the addressee block.
    {
      stack: [
        { text: `${org?.nameUpper ?? 'ММТ'} Ижрочи директори` },
        { text: org?.directorShort ?? '—', bold: true },
      ],
      alignment: 'right',
      margin: [0, 0, 0, 8],
    },
    { text: `${lw} олиш учун`, alignment: 'center' },
    docTitle('АРИЗА'),

    p(
      `${b?.regAddress ?? b?.address ?? '—'} манзилда яшовчи Ўзбекистон Республикаси фуқароси ${b?.fullName ?? '—'}дан:`,
      2,
    ),
    p(`Туғилган санаси: ${b?.birthDate ? `${shortDate(b.birthDate)} йил` : '—'}`),
    p(passportLine),
    p(`Асосий фаолият жойи: ${emp?.employer ?? b?.entrepreneurType ?? '—'}`),
    p(`Лавозими: ${emp?.position ?? '—'}`),
    /*
      `avgMonthlyIncome` is a column the wizard never writes — the operator's "Asosiy daromad" field
      saves to `mainActivityIncome`. Reading only the first one meant this line printed «—» on every
      application no matter what was entered. Kept as the preferred source for older rows that do
      carry it.
    */
    p(`Ўртача ойлик даромад: ${monthlyIncome != null ? `${plainMoney(monthlyIncome)} сум.` : '—'}`),

    p(`Сиздан қуйидаги шартлар асосида менга ${lw} ажратишингизни сўрайман:`, 10),
    p(`${lw} суммаси: ${moneyWithWordsCyr(amount)}.`),
    p(`${lw} муддати: ${term != null ? `${term} (${words(term)}) ойгача` : '—'}.`),
    p(`${lw}дан фойдаланганлик учун фоиз ставкаси: йиллик : ${ratePct != null ? `${ratePct}% (${words(ratePct)}) фоиз` : '—'}`),

    p(`${lw} бўйича асосий қарз ва фоизларни тўлаш шарти:`, 10),
    p(`- асосий қарзни тўлаш ${lw} шартномаси бўйича амалга оширилади`, 2),
    // Verbatim from the sheet — this second condition is printed in Russian on the form.
    p('- осуществляется ежемесячно аннуитетными платежами, по договору микрозайма;', 2),

    p(`${lw} учун таъминот сифатида`, 10),
    ...collateralLines,
  ];

  // Asset products (AVTO/IPOTEKA): the purchased asset is insured (KASKO / property). Cash keeps the
  // loan-risk policy line, still hidden for an auto-only pledge exactly as before.
  const appInsCyr = assetInsuranceLabelCyr(c.product as LoanProduct | null);
  if (appInsCyr) {
    content.push(p(`Гаров объекти ${appInsCyr} бўйича суғурталанади.`, 8)); // TODO(legal)
  } else if (!isAutoOnly(c)) {
    content.push(
      p(
        `Суғурта компаниясининг кредит қайтмаслилиги хавфи полиси. Суғурта полисининг қиймати ${moneyWithWordsCyr(insuredSum)}.`,
        8,
      ),
    );
  }

  content.push(
    p(
      'Менинг мавжуд ва келгусида очиладиган банк пластик карточкаларимдан ва банк ҳисобварақларидан ' +
        '(талаб қилиб олгунча, депозит, жамғариб бориладиган, пластик ва бошқа исталган хисоб рақамларидан) ' +
        'пул маблағларини муддати ўтган қарздорлик юзага келганда акцептсиз тартибда ечиб олинишингизни сўрайман.',
      10,
    ),
    p(
      `${org?.nameUpper ?? 'ММТ'} ва суғурта компанияси ўртасидаги келишув шартлари билан танишдим. ` +
        `Мен, ${org?.nameMixed ?? 'ММТ'} томонидан Мен ва сўралган ${lw} билан боғлиқ барча керакли ` +
        'маълумотларни тақдим этиш ва олиш хуқуқига розилигимни билдираман.',
      8,
    ),
    p('□ Ўзбекистон Республикаси Марказий банки хузуридаги кредит ахборотлари давлат реестри;', 8),
    p('□ "Ўзбекистон Республикаси кредит бюроси" МЧЖ кредит ахборот тахлил маркази;', 2),
    p('□ Гаровга кўйилган мол-мулк тўғрисидаги Гаров реестри;', 2),
    p(`Ариза санаси: ${appDate ? shortDate(appDate) : '—'}й.`, 10),
    p('Ариза топширилган кундаги барча маълумотлар хаққонийлигини тасдиқлайман.', 8),
    {
      columns: [
        { width: '*', text: b?.fullName ?? '—', bold: true },
        { width: 'auto', text: '________________' },
      ],
      columnGap: 12,
      margin: [0, 18, 0, 0],
    },
    { text: '(имзо)', alignment: 'right', fontSize: 8, color: '#555' },
  );

  return { defaultStyle: DOC_DEFAULT_STYLE, pageMargins: DOC_PAGE_MARGINS, content };
}
