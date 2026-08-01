import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { dateToRuCyrillic } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { plainMoney, lineAgreementNo, DOC_DEFAULT_STYLE } from '../doc-layout';

/*
  The cover's box, measured off the sheet.

  «обложка» draws its border on the left of column B and the right of column F, the top of row 2 and
  the bottom of row 36 — nothing else. Those columns total 413.2pt and those rows 723pt, and the
  sheet is set to centre horizontally and vertically, so the box sits centred on the page.

  Everything below is positioned against this box, which is why the wrapping matches: at any other
  width the borrower's name breaks in a different place.
*/
const COVER_W = 413.2;
const COVER_H = 723;
const COVER_SIDE = Math.round((595.28 - COVER_W) / 2);   // A4 width
const COVER_TOP = Math.round((841.89 - COVER_H) / 2);    // A4 height, vertically centred
const COVER_BOTTOM = Math.round((841.89 - COVER_TOP - COVER_H + 14) * 100) / 100;  // …plus the footer line

/*
  The sheet's own row and column boundaries, inside the box — the grid the owner reads the form by.

  Excel does not PRINT these: «обложка» has printGridLines off, and the lines visible in the office's
  screenshot are the application's, which is also where its «Страница 1» watermark comes from. I said
  so and was asked for them twice; they are the owner's form and the owner's call, so here they are,
  drawn from the sheet's actual geometry rather than an even division — row 2 is 48pt, row 12 is 135,
  rows 19–21 are 27.75 each, and the rest are the 15pt default.

  Light grey and hairline, the weight Excel draws them at, so they frame the text without competing
  with it. The last row and column are skipped: those coincide with the box border.
*/
const GRID_ROWS = [
  48, 63, 78, 93, 108, 127.5, 142.5, 157.5, 172.5, 187.5, 322.5, 337.5, 352.5, 367.5, 382.5,
  397.5, 414, 441.75, 469.5, 497.25, 512.25, 527.25, 542.25, 557.25, 572.25, 587.25, 602.25,
  617.25, 632.25, 647.25, 662.25, 677.25, 692.25, 707.25,
];
const GRID_COLS = [104.24, 152.25, 242.23, 308.98];
const GRID_COLOR = '#c9d1d9';
const GRID_WIDTH = 0.4;

/**
 * обложка — the dossier COVER PAGE, matching the reference sheet: the org name at the top, the
 * borrower's name large and centered in the middle, the "№ … СОНЛИ МИКРОМОЛИЯ ЛИНИЯСИ ОЧИШ БЎЙИЧА
 * БОШ КЕЛИШУВ" line, the three key line terms, and the city + date footer.
 *
 * There is no table on this sheet — it is a title page.
 */
export function obloshkaTemplate(c: CaseDocData): TDocumentDefinitions {
  const org = c.organization;
  const b = c.borrower;
  const line = c.creditLine;
  const lineNo = lineAgreementNo(c);
  const termText = line?.termMonths != null ? `${line.termMonths} ойгача` : '—';
  const rateText = line?.interestRate != null ? `${Math.round(Number(line.interestRate) * 100)}%` : '—';
  const amount = line?.amountTotal ?? c.amount ?? null;
  /*
    This sheet closes with «г.», not the «й.» every other form uses — «Тошкент шахар, 23 Июль
    2026 г.» Changed here rather than in dateToRuCyrillic, which the contract, the бош келишув and
    the акт all read and which is right for them.
  */
  const dateText = line?.lineDate ? dateToRuCyrillic(line.lineDate).replace(/ й\.$/, ' г.') : '—';

  return {
    defaultStyle: DOC_DEFAULT_STYLE,
    /*
      The cover has its own page geometry, taken from the sheet rather than from the shared defaults.

      The text sits in columns B..F, which measure 413pt — that is what makes the borrower's name
      wrap to three lines and the org name to two on the reference cover. At our usual 505pt column
      the same text fits in two lines and one, so the page reads differently however the type is
      sized. The sheet is also horizontally AND vertically centred (both flags are set), so its
      723pt of rows sit centred on the page, not hard against the top margin.

      Left/right therefore come from (595.3 − 413.2) / 2; top from (841.9 − 723) / 2; bottom is that
      plus the room the footer line needs, so the date lands on the sheet's last row.
    */
    pageMargins: [COVER_SIDE, COVER_TOP, COVER_SIDE, COVER_BOTTOM],
    /*
      The frame and the grid inside it, drawn as a page background rather than a bordered table so
      they cannot push the content around or split — they are the form, and the spacing of what sits
      on them is set by the margins above.

      Positioned from the actual page size rather than hard-coded A4 numbers, so the box stays
      centred whatever page size the document is rendered at.
    */
    background: (_page: number, size: { width: number; height: number }) => {
      const x0 = (size.width - COVER_W) / 2;
      const y0 = (size.height - COVER_H) / 2;
      return {
        canvas: [
          ...GRID_ROWS.map((dy) => ({
            type: 'line' as const,
            x1: x0, y1: y0 + dy, x2: x0 + COVER_W, y2: y0 + dy,
            lineWidth: GRID_WIDTH, lineColor: GRID_COLOR,
          })),
          ...GRID_COLS.map((dx) => ({
            type: 'line' as const,
            x1: x0 + dx, y1: y0, x2: x0 + dx, y2: y0 + COVER_H,
            lineWidth: GRID_WIDTH, lineColor: GRID_COLOR,
          })),
          // The border last, so it draws over the grid's ends rather than under them.
          { type: 'rect' as const, x: x0, y: y0, w: COVER_W, h: COVER_H, lineWidth: 1.2, lineColor: '#111111' },
        ],
      };
    },
    /*
      Type sizes are the sheet's own — 20 / 36 / 16 / 11, read off the cells rather than chosen.

      The 36pt name is the point of the page: it wraps to two or three lines on a long name, which
      is what the reference cover does and what makes a dossier findable in a stack of them. The
      gaps between the blocks are in the proportion of the sheet's own empty rows (9 : 6 : 5 : 8).

      The three terms lines carry a leading space because the cells do.
    */
    content: [
      { text: org?.nameUpper ?? 'ММТ', bold: true, alignment: 'center', fontSize: 20, decoration: 'underline', margin: [0, 14, 0, 0] },

      { text: b?.fullName ?? '—', bold: true, alignment: 'center', fontSize: 36, margin: [0, 167, 0, 0] },

      {
        text: `№ ${lineNo} СОНЛИ МИКРОМОЛИЯ ЛИНИЯСИ ОЧИШ БЎЙИЧА БОШ КЕЛИШУВ`,
        bold: true,
        alignment: 'center',
        fontSize: 16,
        margin: [0, 39, 0, 0],
      },

      { text: ` Фоиз ставкаси: ${rateText}`, bold: true, fontSize: 11, margin: [0, 81, 0, 0] },
      { text: ` Микромолия линияси муддати: ${termText}`, bold: true, fontSize: 11 },
      { text: ` Микромолия линияси  миқдори: ${amount != null ? `${plainMoney(amount)} сум` : '—'}`, bold: true, fontSize: 11 },

    ],
    /*
      The city and date sit in the page footer, not at the end of the content.

      On the sheet they are the last row before the bottom border — 98.9% of the way down. As a
      content element that is unreachable: pdfmake needs the whole line to fit above the bottom
      margin, and a gap large enough to put it there pushed the cover onto a second page. In the
      footer band it lands where the sheet puts it, and it cannot overflow.
    */
    footer: () => ({
      text: `Тошкент шахар, ${dateText}`,
      bold: true, alignment: 'center', fontSize: 11, margin: [0, 3, 0, 0],
    }),
  };
}
