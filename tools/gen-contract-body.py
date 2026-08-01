# -*- coding: utf-8 -*-
"""Emit contract-body.ts from the reference sheet, so the legal text is machine-copied."""
import io, sys, json

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
rows = json.load(io.open('contract-rows.json', encoding='utf-8'))

NAMES = {
    1: 'title', 3: 'cityDate', 5: 'preamble', 8: 'c11', 16: 'c24',
    23: 'c31', 24: 'c311auto', 25: 'c311realty', 31: 'c411item', 32: 'c412insurance',
}

BACKSLASH = chr(92)
QUOTE = chr(39)


def esc(s):
    return s.replace(BACKSLASH, BACKSLASH * 2).replace(QUOTE, BACKSLASH + QUOTE)


slots = [NAMES[r['row']] for r in rows if r['kind'] == 'DYNAMIC']

head = """/**
 * The Uzbek microcredit contract, as «договор узб» of «АВТО мфл APEX (2).xlsx» prints it.
 *
 * The static clauses are copied from that sheet character for character — including its own
 * spelling («накд», «еки», «мажуриятлари») — because the form is the agreed wording, and a
 * document that reads differently from it is a different document. They sit here as data rather
 * than inside the template so that taking the next revision is a diff of strings instead of a
 * rewrite of layout code.
 *
 * Ten places are not static; they carry the case. Those are named slots, filled by contract.ts.
 *
 * GENERATED from the reference sheet — clauses are not to be retyped by hand. To take a new
 * revision, re-extract the sheet and regenerate.
 */

/** A place where the case's own values go. contract.ts owns the wording of each. */
export type ContractSlot =
"""

parts = [head]
parts.append('  | ' + ('\n  | '.join("'" + s + "'" for s in slots)) + ';\n')
parts.append("""
export type ContractLine =
  | { kind: 'heading'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'slot'; slot: ContractSlot };

/** Every line of the contract, in the sheet's own order. */
export const CONTRACT_LINES: ContractLine[] = [
""")

for r in rows:
    if r['kind'] == 'DYNAMIC':
        parts.append("  { kind: 'slot', slot: '" + NAMES[r['row']] + "' },\n")
    elif r['kind'] == 'section':
        parts.append("  { kind: 'heading', text: '" + esc(r['text']) + "' },\n")
    else:
        parts.append("  { kind: 'text', text: '" + esc(r['text']) + "' },\n")

parts.append('];\n')
src = ''.join(parts)

out = r'C:\Users\JONIBEK\Desktop\fininvest\apps\backend\src\output\documents\templates\contract-body.ts'
io.open(out, 'w', encoding='utf-8', newline='').write(src)
print('contract-body.ts yozildi:', len(src), 'belgi,', len(rows), 'qator,', len(slots), 'slot')
