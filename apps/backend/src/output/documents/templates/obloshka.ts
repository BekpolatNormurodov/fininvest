import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { dateToRuCyrillic } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { plainMoney, lineAgreementNo, DOC_DEFAULT_STYLE } from '../doc-layout';

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
      The cover uses its own vertical margins, not the shared ones.

      The sheet prints at 0.315" all round — 23pt — while every other document here sits at 50pt top
      and bottom. With 50pt the seven blocks are squeezed into a shorter band and none of them land
      where the reference puts them; measured, the footer sat 5.3 percentage points too high up the
      page. 26pt keeps a little air inside the frame and reproduces the sheet's band.
    */
    pageMargins: [45, 26, 45, 44],
    /*
      The cover's frame. Drawn as a page background rather than a bordered table so it cannot push
      the content around or split — it is decoration, and the title page's spacing is set by the
      margins above it.

      Sized from the actual page rather than hard-coded A4 numbers, so it stays inset by the same
      18pt whatever page size the document is rendered at.
    */
    background: (_page: number, size: { width: number; height: number }) => ({
      canvas: [{
        type: 'rect',
        x: 18, y: 18,
        w: size.width - 36, h: size.height - 36,
        lineWidth: 1.2,
        lineColor: '#111111',
      }],
    }),
    /*
      Type sizes are the sheet's own — 20 / 36 / 16 / 11, read off the cells rather than chosen.

      The 36pt name is the point of the page: it wraps to two or three lines on a long name, which
      is what the reference cover does and what makes a dossier findable in a stack of them. The
      gaps between the blocks are in the proportion of the sheet's own empty rows (9 : 6 : 5 : 8).

      The three terms lines carry a leading space because the cells do.
    */
    content: [
      { text: org?.nameUpper ?? 'ММТ', bold: true, alignment: 'center', fontSize: 20, decoration: 'underline', margin: [0, 14, 0, 0] },

      { text: b?.fullName ?? '—', bold: true, alignment: 'center', fontSize: 36, margin: [0, 214, 0, 0] },

      {
        text: `№ ${lineNo} СОНЛИ МИКРОМОЛИЯ ЛИНИЯСИ ОЧИШ БЎЙИЧА БОШ КЕЛИШУВ`,
        bold: true,
        alignment: 'center',
        fontSize: 16,
        margin: [0, 106, 0, 0],
      },

      { text: ` Фоиз ставкаси: ${rateText}`, bold: true, fontSize: 11, margin: [0, 94, 0, 0] },
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
