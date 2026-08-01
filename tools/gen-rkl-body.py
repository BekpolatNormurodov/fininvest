# -*- coding: utf-8 -*-
"""Emit rkl-body.ts from the reference sheet, so the legal text is machine-copied."""
import io, sys, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
rows = json.load(io.open('rkl-rows.json', encoding='utf-8'))

SLOTS = {2: 'title', 4: 'preamble', 6: 'c11', 18: 'c24rate', 26: 'pledge', 27: 'insurance'}
HEADINGS = {5, 7, 24, 36, 40, 47}
STOP = 50  # article 7 onward is the live requisites block

BS, Q = chr(92), chr(39)
def esc(s):
    return s.replace(BS, BS * 2).replace(Q, BS + Q).replace('\n', BS + 'n')

out = []
for r in range(1, STOP):
    cells = [x for x in rows if x['row'] == r and x['col'] == 'A']
    if r in SLOTS:
        out.append("  { kind: 'slot', slot: '" + SLOTS[r] + "' },")
        continue
    if not cells:
        continue
    t = cells[0]['text'].strip()
    kind = 'heading' if r in HEADINGS else 'text'
    out.append("  { kind: '" + kind + "', text: '" + esc(t) + "' },")

head = '''/**
 * The бош келишув, as «РКЛ Ген» of «АВТО мфл APEX (2).xlsx» prints it.
 *
 * Machine-copied from that sheet, including its own spelling («хисобланмайди», «етишга», «ташки
 * қилади») and its own numbering slips — it carries two clauses numbered 2.5 and two numbered 5.5.
 * The form is the agreed wording; a document that reads differently from it is a different document.
 *
 * Six places are not static; they carry the case. Those are named slots, filled by rkl-apex.ts.
 *
 * GENERATED from the reference sheet — clauses are not to be retyped by hand. To take a new
 * revision, re-extract the sheet and regenerate.
 */

/** A place where the case's own values go. rkl-apex.ts owns the wording of each. */
export type RklSlot =
  | 'title'
  | 'preamble'
  | 'c11'
  | 'c24rate'
  | 'pledge'
  | 'insurance';

export type RklLine =
  | { kind: 'heading'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'slot'; slot: RklSlot };

/** Every line of the agreement, in the sheet's own order, up to the requisites block. */
export const RKL_LINES: RklLine[] = [
'''
src = head + '\n'.join(out) + '\n];\n'
p = r'C:\Users\JONIBEK\Desktop\fininvest\apps\backend\src\output\documents\templates\rkl-body.ts'
io.open(p, 'w', encoding='utf-8', newline='').write(src)
print('rkl-body.ts:', len(src), 'belgi,', len(out), 'qator,', sum(1 for o in out if 'slot' in o), 'slot')
