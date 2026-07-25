import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { moneyWithWordsCyr } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { shortDate, DOC_DEFAULT_STYLE, DOC_PAGE_MARGINS } from '../doc-layout';
import { assetInsuranceLabelCyr, type LoanProduct } from '@credit-core/shared';
import { p, lineTerms } from './_shared';
import { autoDescription, realtyDescription, isAutoOnly } from './_collateral';

/**
 * Ходатайство (Мурожаатнома) — the client's petition to open a microfinance line, matching the
 * Excel: addressee block, title, the request paragraph, the 5 numbered ММЛ conditions, the
 * таъминот/collateral prose, the insurance-polis line (hidden when auto-only), the "хабардор
 * қилинган ва розилигини билдирган" acknowledgements, date and signature.
 */
export function petitionTemplate(c: CaseDocData): TDocumentDefinitions {
  const org = c.organization;
  const line = c.creditLine;
  const b = c.borrower;

  const name = b?.fullName ?? '—';
  const address = b?.regAddress ?? b?.address ?? '—';
  const passport = [b?.passportSeries, b?.passportNumber].filter(Boolean).join(' ') || '—';
  const dateStr = line?.lineDate ? `${shortDate(line.lineDate)}й.` : '—';
  const insuredSum = line?.insurance?.insuredSum ?? line?.amountPolis ?? null;

  const collateralLines: Content[] = (c.collaterals ?? []).map((col) => ({
    text: `- ${col.type === 'AUTO' ? autoDescription(col) : realtyDescription(col)}`,
    alignment: 'justify',
    margin: [0, 2, 0, 0],
  }));

  const content: Content[] = [
    // NOTE: the reference sheet has NO org letterhead — it opens with the addressee block.
    {
      stack: [
        { text: `${org?.nameUpper ?? 'ММТ'} ижрочи директори` },
        { text: `${org?.directorShort ?? '—'}га`, bold: true },
      ],
      alignment: 'right',
      margin: [0, 0, 0, 12],
    },
    { text: 'Микромолия линиясини очиш тўғрисида', bold: true, alignment: 'center' },
    { text: 'МУРОЖААТНОМА', bold: true, alignment: 'center', fontSize: 13, margin: [0, 2, 0, 12] },

    p('Сиздан қуйидаги шартлар асосида микроқарз/микрокредитлар олиш учун қуйидаги шартларда Микромолиявий линия (ММЛ) очиб бериш масаласини кўриб чиқишингизни сўрайман:'),

    ...lineTerms(c),

    { text: '5. Микромолия линияси таъминоти:', margin: [0, 4, 0, 3] },
    ...collateralLines,
  ];

  // Asset products (AVTO/IPOTEKA): the purchased asset is insured (KASKO / property). Cash keeps the
  // sheet's loan-risk line, still hidden for an auto-only pledge exactly as before.
  const petInsCyr = assetInsuranceLabelCyr(c.product as LoanProduct | null);
  if (petInsCyr) {
    content.push({ text: `- Гаров объекти ${petInsCyr} бўйича суғурталанади`, margin: [0, 3, 0, 0] }); // TODO(legal)
  } else if (!isAutoOnly(c)) {
    // Verbatim from the sheet — it names no company and no sum on this line.
    content.push({ text: '- Суғурта компаниясининг кредит қайтмаслик риски полиси', margin: [0, 3, 0, 0] });
  }

  content.push(
    p(`${name} қуйидагилардан хабардор қилинган ва розилигини билдирган:`),
    p('- ММТ микромолия линиясини очиш тўғрисидаги Бош келишув (бундан буён матнда "Бош келишув" деб юритилади) тузишни ўз зиммасига олади, унинг асосида микроқарз/микрокредитлар бериш алоҳида тузилган микроқарз/микрокредит шартномалари бўйича амалга оширилади;'),
    p('- Бош Келишувда микроқарз/микрокредит бериш ҳажми ва асосий шартлари олдиндан белгилаб қўйилган;'),
    p(`- ММТларнинг тузилган Бош Келишув доирасида микроқарз/микрокредит шартномаларини тузиш ва микроқарз/микрокредитлар бериш шартли хисобланмайди. ММТ ва ${name} билан микроқарз/микрокредит шартномаларини тузиш мажбуриятидан воз кечиш ва Бош Келишувда назарда тутилган ҳолларда микроқарз/микрокредитлар бериш ҳуқуқига эга;`),
    p(`- ${name} томонидан тақдим этилган хужжатлар ва ушбу мурожаатноманинг асл нусхаси, ММТ томонидан микромолия линиясини очишни рад этган тақдирда ҳам ММТ да сақланади;`),
    p('- Микромолия ташкилотининг ушбу мурожаатномани қабул қилиши Микромолия ташкилотига Бош Келишув тузиш мажбуриятини юкламайди.'),
    { text: `Мурожаатнома санаси: ${dateStr}`, margin: [0, 12, 0, 12] },
    {
      columns: [
        { width: '*', text: name, bold: true },
        { width: 'auto', text: 'имзо ___________________' },
      ],
      columnGap: 12,
      margin: [0, 6, 0, 0],
    },
    { text: `Манзил: ${address}`, fontSize: 9, color: '#555', margin: [0, 2, 0, 0] },
    { text: `Паспорт: ${passport}`, fontSize: 9, color: '#555' },
  );

  return { defaultStyle: DOC_DEFAULT_STYLE, pageMargins: DOC_PAGE_MARGINS, content };
}
