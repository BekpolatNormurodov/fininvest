import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { moneyWithWordsCyr } from '../../../common/sum-to-words.util';
import { CaseDocData } from '../case-document.loader';
import { DOC_DEFAULT_STYLE, DOC_PAGE_MARGINS } from '../doc-layout';
import { p } from './_shared';
import { loanProductProfile, LoanProductKind } from '@credit-core/shared';

/** 16-digit card → "0000 0000 0000 0000"; any other length is left as-is. */
function groupCard(n: string | null | undefined): string {
  if (!n) return '—';
  const digits = n.replace(/\D/g, '');
  return digits.length === 16 ? digits.replace(/(.{4})/g, '$1 ').trim() : n;
}

/**
 * Пул ўтказиш аризаси — «Мижоз аризаси тўлов учун» (item 13 of the filing list): the borrower's
 * letter asking the org to transfer the contracted microloan to a bank account/card. The destination
 * account may belong to a third party — all requisites come from `DisbursementDetail`, never from
 * `Borrower.inn`.
 *
 * There is no reference sheet for this form, so it follows the АРИЗА layout of the set: addressee
 * block, title, request paragraph, plain requisite lines (no table), signature strip.
 */
export function disbursementTemplate(c: CaseDocData): TDocumentDefinitions {
  const org = c.organization;
  const b = c.borrower;
  const d = c.disbursement;
  // Asset products (AVTO/IPOTEKA): the money is paid to the SELLER, so fall back to the seller's
  // requisites when the disbursement detail has not been filled separately.
  const isAsset = c.product ? loanProductProfile(c.product).kind === LoanProductKind.ASSET : false;
  const seller = isAsset ? c.seller : null;
  const holderName = d?.holderName ?? seller?.orgName ?? seller?.fullName ?? '—';
  const cardNumber = d?.cardNumber ?? null;
  const accountNumber = d?.accountNumber ?? seller?.bankAccount ?? '—';
  const bankMfo = d?.bankMfo ?? seller?.mfoCode ?? '—';
  const holderInn = d?.holderInn ?? seller?.stir ?? '—';
  const bankName = d?.bankName ?? seller?.bankName ?? '—';
  const amount = c.creditLine?.amountTotal ?? c.amount ?? null;

  const line = (label: string, value: string): Content => ({ text: `${label}: ${value}`, margin: [0, 2, 0, 0] });

  return {
    defaultStyle: DOC_DEFAULT_STYLE,
    pageMargins: DOC_PAGE_MARGINS,
    content: [
      {
        stack: [
          { text: org?.nameUpper ?? 'ММТ' },
          { text: 'Ижрочи директори' },
          { text: `${org?.directorShort ?? '—'}га`, bold: true },
        ],
        alignment: 'right',
        margin: [0, 0, 0, 12],
      },
      /*
        The applicant block sits under the addressee on the right half of the page, the way the
        paper form is laid out — not across the full width on the left, where it read as body text
        and collided with the heading below it.

        Address, name and «томонидан» each get their own line: run together they made one long
        paragraph that wrapped mid-address and buried the applicant's name in the middle of it.
      */
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 300,
            stack: [
              { text: `${b?.regAddress ?? b?.address ?? '—'}да яшовчи`, margin: [0, 0, 0, 1] },
              { text: b?.fullName ?? '—', bold: true },
              { text: 'томонидан' },
            ],
          },
        ],
        margin: [0, 0, 0, 2],
      },
      { text: 'АРИЗА', bold: true, alignment: 'center', fontSize: 13, margin: [0, 6, 0, 10] },
      p(
        `Ушбу ариза билан мен ${b?.fullName ?? '—'}, сиздан ${org?.nameUpper ?? 'ММТ'} билан имзоланган ` +
          `№ ${c.contractNumber ?? c.number ?? '—'} сонли Микроқарз Шартномасига асосан ${moneyWithWordsCyr(amount)} ` +
          `микроқарзни қуйидаги ҳисоб рақамга ўтказиб беришингизни сўрайман.`,
      ),
      { text: 'Тўлов реквизитлари:', bold: true, margin: [0, 10, 0, 2] },
      line('Ҳисоб эгаси', holderName),
      line('Карта рақами', groupCard(cardNumber)),
      line('Ҳисоб рақами (Х/Р)', accountNumber),
      line('МФО', bankMfo),
      line('ИНН', holderInn),
      line('Банк', bankName),
      /*
        The signature row is three real columns, matching the caption row below it. It used to be a
        single string padded with spaces — so the rules drifted away from «Имзо» and «Сана» as soon
        as the name was any longer than the sample, which is most names.
      */
      {
        columns: [
          { width: '*', text: b?.fullName ?? '—' },
          { width: 120, text: '______________', alignment: 'center' },
          { width: 100, text: '____________', alignment: 'right' },
        ],
        columnGap: 12,
        margin: [0, 26, 0, 0],
      },
      {
        columns: [
          { width: '*', text: 'Ф.И.Ш.', fontSize: 8, color: '#555' },
          { width: 120, text: 'Имзо', alignment: 'center', fontSize: 8, color: '#555' },
          { width: 100, text: 'Сана', alignment: 'right', fontSize: 8, color: '#555' },
        ],
        columnGap: 12,
        margin: [0, 2, 0, 0],
      },
    ],
  };
}
