import { mockCaseDoc, flattenDocText } from '../__fixtures__/case-doc.fixture';
import { cheklistTemplate } from './cheklist';

describe('cheklistTemplate (перечень)', () => {
  it('renders the fixed 16-row filing list with the Excel column headers', () => {
    const text = flattenDocText(cheklistTemplate(mockCaseDoc()));

    expect(text).toContain('МФЛ бўйича хужжатлар кетма кетлиги');
    expect(text).toContain('№ т/р');
    expect(text).toContain('Хужжат номланиши');
    expect(text).toContain('Экз сони');
    expect(text).toContain('Варок');
    // First and last items, in the Excel's filing order.
    expect(text).toContain('Мижоз бирламчи хужжатлари');
    expect(text).toContain('МФЛ очиш бўйича бош келишув');
    expect(text).toContain('Претензионный');
    expect(text).toContain('16');
  });

  it('keeps the passport note on row 1 and closes with the credit-manager signature', () => {
    const text = flattenDocText(cheklistTemplate(mockCaseDoc()));
    expect(text).toContain('Аслидан нусха олинди');
    expect(text).toContain('Кредит менежери имзоси:');
  });

  it('cash form is identical regardless of the (cash) case data', () => {
    const a = flattenDocText(cheklistTemplate(mockCaseDoc()));
    const b = flattenDocText(cheklistTemplate(mockCaseDoc({ documents: [] as unknown as never, contractNumber: 'X-999' })));
    expect(a).toBe(b);
  });

  it('asset (AVTO/IPOTEKA) filing list swaps pledge rows for the asset-purchase papers', () => {
    const text = flattenDocText(cheklistTemplate(mockCaseDoc({ product: 'AVTO' as unknown as never })));
    expect(text).toContain('Олди-сотди шартномаси');
    expect(text).toContain('Суғурта полиси (КАСКО / мол-мулк)');
    expect(text).toContain('Бошланғич тўлов квитанцияси');
    // The separate cash-pledge deed does not belong on an asset filing.
    expect(text).not.toContain('Гаров Шартномаси');
  });
});
