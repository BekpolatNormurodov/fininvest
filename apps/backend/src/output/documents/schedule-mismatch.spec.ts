import { scheduleForCase } from './schedule';
import { DOC_REGISTRY } from './registry';
import * as ExcelJS from 'exceljs';
import { exportScheduleToExcel } from '../excel-export.util';
import { mockCaseDoc, flattenDocText } from './__fixtures__/case-doc.fixture';

/*
  «заявку на 110 млн открывали… график 1,100,000 млнга корсатвоти > бза 110,000,000 млнга очканмиза.»

  The line was opened for 110 000 000 and the tranche carried 1 100 000 — a hundredth. The contract
  stated one sum and Илова №1 amortised the other, and the case was signed like that. Nothing failed,
  because each document was internally consistent.

  What is refused is a tranche that is a clean power of ten off the line: that is a mistyped zero,
  never a drawdown. A line legitimately drawn in parts — 150M drawn 60M — must still print, and the
  last test here is the one that guards that, because a naive «the two numbers differ» rule would
  break every multi-tranche case in the book.
*/
const mismatched = (line: number, principal: number) =>
  mockCaseDoc({
    amount: line,
    creditLine: {
      amountTotal: line,
      tranches: [{ principal, schedule: null as never }],
    } as never,
  });

describe('a schedule is not printed for a tranche the line cannot support', () => {
  it.each([
    ['ten times', 110_000_000, 11_000_000],
    ['a hundred times', 110_000_000, 1_100_000],
    ['a thousand times', 110_000_000, 110_000],
  ])('refuses a tranche %s smaller than the line', (_label, line, principal) => {
    expect(scheduleForCase(mismatched(line, principal))).toBeNull();
  });

  it('the график says so instead of amortising the wrong number', () => {
    const t = flattenDocText(DOC_REGISTRY['grafik']!.build(mismatched(110_000_000, 1_100_000)));
    expect(t).toContain('ҳисобланмаган');
    // The wrong figure must not appear as a schedule row anywhere on the page.
    expect(t).not.toContain('1 100 000,00');
  });

  it('the Excel export degrades the same way — it is the second consumer', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await exportScheduleToExcel(mismatched(110_000_000, 1_100_000)) as never);
    const cells: string[] = [];
    wb.getWorksheet('График')!.eachRow((r) => r.eachCell((cell) => cells.push(String(cell.value ?? ''))));
    expect(cells).toContain("To'lov jadvali hisoblanmagan");
    expect(cells).not.toContain('1100000');
  });
});

describe('an ordinary multi-tranche line still prints its schedule', () => {
  /*
    150M line, 60M drawn. §1.1 states the ceiling and the schedule states the draw — they SHOULD
    differ. This is the case a «fields must match» rule would have broken.
  */
  it('60 000 000 drawn against a 150 000 000 line amortises the 60 000 000', () => {
    const s = scheduleForCase(mismatched(150_000_000, 60_000_000));
    expect(s).not.toBeNull();
    expect(s!.principal).toBe(60_000_000);
  });

  it('a tranche equal to the line prints normally', () => {
    const s = scheduleForCase(mismatched(150_000_000, 150_000_000));
    expect(s).not.toBeNull();
    expect(s!.principal).toBe(150_000_000);
  });

  // Off by a power of ten the OTHER way is not a mistyped zero on the tranche — the line is the
  // smaller number, and the existing «bigger than the line» rule already refuses that separately.
  it('the fixture case, unchanged, still renders', () => {
    expect(scheduleForCase(mockCaseDoc())).not.toBeNull();
  });
});
