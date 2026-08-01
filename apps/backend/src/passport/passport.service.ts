import { Injectable } from '@nestjs/common';
import path from 'path';
import sharp from 'sharp';
import { createWorker, createScheduler, PSM } from 'tesseract.js';

// Each scan preprocesses 8 one-shot images (4 orientations × 2 passes) that are never reused, so
// libvips' operation cache only piles up memory with no hit benefit — disable it.
sharp.cache(false);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parse } = require('mrz');
import type { PassportScanResult, TexScanResult } from '@credit-core/shared';
import { extractMrzLines, normalizeMrzLines, mapMrzToBorrower, namesFromMrzLine, scoreConfidence, expiryWarnings, MrzDetail } from './mrz.util';
import { extractIdFront, extractIdBackViz, mergeIdResult, extractPassportViz } from './id-fields.util';
import { extractTexFromFields, mergeFields, numberedFields } from './tex-fields.util';

/** OCR a preprocessed image buffer → raw text. Injectable so the pipeline is unit-testable. */
export type OcrFn = (image: Buffer) => Promise<string>;

const ORIENTATIONS = [0, 270, 90, 180];
// Worker-pool sizes. The MRZ pool OCRs all 4 orientations concurrently (one worker each); the text
// pool reads the two ID sides (or one passport page) in parallel. Bounded well under the host cores.
const MRZ_POOL = 4;
const TEXT_POOL = 2;
// tex-passport eng pool size — one worker per parallel OCR pass. Sized to the OCR container's CPU cap
// (OCR_WORKERS): with 3 replicas × 3 cores, 4 is a good match; a single big replica can go higher.
const TEX_WORKERS = Math.max(1, Number(process.env.OCR_WORKERS) || 8);
const MRZ_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
// Dedicated OCR-B / MRZ model (BSD-3, DoubangoTelecom/tesseractMRZ). The general 'eng' model
// misreads the MRZ font — '<' as K/C/L, A→4, Z→2 — so the header text wins; 'mrz' reads it cleanly.
const OCR_LANG = 'mrz';
// The 'mrz' model is not on the tesseract CDN, so a local traineddata dir is mandatory. Prod sets
// TESSDATA_PATH; otherwise resolve the bundled dir next to the backend root (works in dist + tests).
const TESSDATA_DIR = process.env.TESSDATA_PATH || path.join(__dirname, '..', '..', 'tessdata');

/**
 * OCR is CPU-bound (each scan spins up 4–8 tesseract worker threads for 10–40s). The backend is ONE
 * Node process serving all four portals, so uncapped concurrent scans saturate every core and freeze
 * the whole system for everyone. This gate serializes scans (default 1 at a time; raise via
 * OCR_MAX_CONCURRENT on a bigger box) — excess scans queue instead of multiplying the CPU load.
 */
class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;
  constructor(private readonly max: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }
}
const OCR_MAX_CONCURRENT = Math.max(1, Number(process.env.OCR_MAX_CONCURRENT) || 1);
const ocrGate = new Semaphore(OCR_MAX_CONCURRENT);

/** One orientation's parse result plus its check-digit confidence and the orientation it came from. */
interface Candidate {
  parsed: any;
  conf: number;
  lines: string[];
  angle: number;
}

function emptyResult(): PassportScanResult {
  return {
    confidence: 0,
    fields: { fullName: '', passportSeries: '', passportNumber: '', birthDate: null, passportExpiry: null, gender: '', nationality: '', pinfl: '' },
    perField: [],
    format: '',
    rawMrz: [],
    warnings: ['mrz_not_found'],
  };
}

/** A PDF upload (by magic bytes) — passports/IDs are often scanned as PDF rather than an image. */
function isPdf(file: Buffer): boolean {
  return file.length >= 5 && file.subarray(0, 5).toString('latin1') === '%PDF-';
}

// pdf-to-img is ESM-only; the backend compiles to CommonJS, which would down-level a TS `import()`
// to `require()` (fatal for ESM). Wrap it in `new Function` so a genuine dynamic import survives.
const esmImport = new Function('s', 'return import(s)') as (s: string) => Promise<any>;

/** Rasterize a PDF's first page to a PNG buffer for the OCR pipeline. */
async function pdfFirstPageToPng(file: Buffer): Promise<Buffer> {
  const { pdf } = await esmImport('pdf-to-img');
  const doc = await pdf(file, { scale: 2.5 });
  for await (const page of doc) return page as Buffer; // first page only
  throw new Error('empty PDF');
}

@Injectable()
export class PassportService {
  /** Normalize an upload to a raster image — a PDF's first page is rendered to PNG. */
  private async toImage(file: Buffer): Promise<Buffer> {
    return isPdf(file) ? pdfFirstPageToPng(file) : file;
  }

  /** Scan a passport image/PDF buffer. Pass `ocr` in tests to stub OCR; production uses tesseract.js. */
  async scan(file: Buffer, ocr?: OcrFn): Promise<PassportScanResult> {
    file = await this.toImage(file);
    // Crop the bottom MRZ band FIRST: a strip has far less for the model to process (~1.3s/call vs
    // ~5s for a full page), so a well-framed passport reads in a few seconds instead of ~20s. Full
    // frame is the fallback for a passport small/high in the frame (MRZ not at the bottom).
    if (ocr) return this.run(file, ocr, [true, false]);
    return ocrGate.run(async () => {
    // mrz pool OCRs all orientations in parallel; eng reads the visible page (VIZ) for the fields the
    // MRZ lacks (place of birth, issue date, issuer). Both models ship as raw .traineddata locally.
    const [mrz, text] = await Promise.all([
      this.makeScheduler(OCR_LANG, MRZ_POOL, { tessedit_char_whitelist: MRZ_WHITELIST }),
      this.makeScheduler('eng', 1),
    ]);
    try {
      const best = await this.findBestMrz(file, mrz.ocr, [true, false]);
      const result = this.mrzToResult(best);
      // Fill the VIZ-only fields the MRZ lacks by OCR-ing the visible page at the orientation the MRZ
      // was found. Best-effort: a VIZ hiccup must never fail the (verified) MRZ result.
      if (best && best.conf > 0) {
        try {
          const vizText = await text.ocr(await this.preprocessViz(file, best.angle, 1500));
          /*
            An ID card is not a passport page, and reading it as one is why «Kim bergan» and
            «Berilgan sana» came back empty every time.

            A TD1 card splits the two across its faces: the issue date is printed on the front, the
            authority on the back. extractPassportViz looks for a passport data page's labels —
            «DATE OF ISSUE», «KIM TOMONIDAN BERILGAN» — and an ID card carries neither, so both
            fields were guaranteed to be blank however good the scan was. The MRZ already tells us
            which document this is, so use it.

            One face still cannot yield both. When the half we were given is missing one, say so
            rather than leaving the operator to guess why a field stayed empty — the ID-card tab
            takes both sides.
          */
          const isId = result.format === 'TD1';
          const viz = isId
            ? { ...extractIdBackViz(vizText), issueDate: extractIdFront(vizText).issueDate }
            : extractPassportViz(vizText);
          const unverified: string[] = [];
          if (viz.placeOfBirth) { result.fields.placeOfBirth = viz.placeOfBirth; unverified.push('placeOfBirth'); }
          if (viz.issueDate) { result.fields.passportIssueDate = viz.issueDate; unverified.push('passportIssueDate'); }
          if (viz.issuer) { result.fields.passportIssuer = viz.issuer; unverified.push('passportIssuer'); }
          result.docType = isId ? 'ID' : 'PASSPORT';
          if (isId) {
            // Present even when empty, so the form renders a field to type into (see mergeIdResult).
            result.fields.passportIssueDate = viz.issueDate ?? null;
            result.fields.passportIssuer = viz.issuer || '';
            if (!viz.issuer || !viz.issueDate) result.warnings.push('id_other_side_needed');
          }
          if (unverified.length) result.unverifiedFields = unverified;
        } catch {
          /* VIZ is best-effort; keep the verified MRZ result */
        }
      }
      return result;
    } finally {
      await Promise.all([mrz.terminate(), text.terminate()]);
    }
    });
  }

  /**
   * Find the best MRZ candidate across orientations/bands (or null). `bands`: `false` = full frame,
   * `true` = cropped bottom MRZ band. Exposes the winning orientation so the passport VIZ can be
   * OCR'd at the same angle. Prefers a fully-valid parse; ID back stops early on high confidence.
   */
  /** OCR one orientation → a parse candidate (or null if no MRZ is there). */
  private async ocrOrientation(file: Buffer, angle: number, binarize: boolean, cropBand: boolean, ocr: OcrFn): Promise<Candidate | null> {
    const img = await this.preprocess(file, angle, binarize, cropBand);
    const text = await ocr(img);
    const lines = extractMrzLines(text);
    if (lines.length < 2) return null;
    // OCR rarely nails the exact 44/36/30-char width; the strict parser throws otherwise.
    const norm = normalizeMrzLines(lines);
    let parsed: any;
    try {
      parsed = parse(norm);
    } catch {
      return null;
    }
    return { parsed, conf: scoreConfidence((parsed.details ?? []) as MrzDetail[]), lines: norm, angle };
  }

  private async findBestMrz(file: Buffer, ocr: OcrFn, bands: boolean[] = [false], earlyExitConf?: number): Promise<Candidate | null> {
    let best: Candidate | null = null;
    // Prefer a fully-valid parse over a higher-conf-but-invalid one. MRZ check digits do NOT cover
    // the name field, so a parse with a corrupted name can still score 100%; only `valid` reflects a
    // self-consistent, correctly-framed read.
    const consider = (c: Candidate | null) => {
      if (!c) return;
      const better = !best || (c.parsed.valid && !best.parsed.valid) || (c.parsed.valid === best.parsed.valid && c.conf > best.conf);
      if (better) best = c;
    };
    // Stop after a pass once we have a fully-valid parse, or (ID back) high enough check-digit confidence.
    const done = () => best != null && (best.parsed.valid || (earlyExitConf != null && best.conf >= earlyExitConf));
    for (const cropBand of bands) {
      for (const binarize of [false, true]) {
        // All 4 orientations OCR CONCURRENTLY (the injected ocr is pool-backed) → wall-clock ≈ 1 call.
        (await Promise.all(ORIENTATIONS.map((angle) => this.ocrOrientation(file, angle, binarize, cropBand, ocr)))).forEach(consider);
        if (done()) return best;
      }
    }
    return best;
  }

  /** A tesseract worker pool exposing one `ocr` fn that distributes jobs across the workers, so
   *  concurrent OCR calls run in parallel. `terminate` frees all workers. */
  private async makeScheduler(lang: string, size: number, params?: Record<string, unknown>): Promise<{ ocr: OcrFn; terminate: () => Promise<void> }> {
    const scheduler = createScheduler();
    const workers = await Promise.all(
      Array.from({ length: size }, () => createWorker(lang, 1, { langPath: TESSDATA_DIR, cacheMethod: 'none', gzip: false })),
    );
    if (params) await Promise.all(workers.map((w) => w.setParameters(params as any)));
    workers.forEach((w) => scheduler.addWorker(w));
    return {
      ocr: async (img: Buffer) => (await scheduler.addJob('recognize', img)).data.text,
      terminate: () => scheduler.terminate(),
    };
  }

  /** Map the best MRZ candidate to the API result (or an empty "not found" result). */
  private mrzToResult(best: Candidate | null): PassportScanResult {
    // conf 0 = every check digit failed → OCR latched onto non-MRZ text (e.g. the passport header)
    // that normalizeMrzLines padded into a parseable shape. Surface a clean "not found".
    if (!best || best.conf === 0) return emptyResult();
    const fields = mapMrzToBorrower(best.parsed.fields ?? {});
    /*
      The strict parser nulls the given name when OCR leaves junk in the name field's filler
      («VASKAROV<<MUXTOR<<<<<<<20L46» → firstName null → "MUXTOR" lost, and the scan reports the
      surname alone). Re-derive from the raw name line and take it when it recovers more tokens.

      This ran for TD1 only, so a passport — TD3 — kept losing the given name and the patronymic:
      «P<UZBKARIMOV<<ALISHER<BAXTIYOROVICH<<<<20L46» came back as "KARIMOV". The name line is the
      LAST line on a TD1 and the FIRST on a TD3/TD2, where it is prefixed by the document code and
      the issuing state («P<UZB»), five characters that have to come off before the names start.

      Verified not to fire on a clean read: on an unpolluted TD3 the salvaged token count equals the
      parsed one, so the parser's own value stands.
    */
    const nameLine = best.parsed.format === 'TD1'
      ? (best.lines[best.lines.length - 1] || '')
      : (best.lines[0] || '').slice(5);
    const raw = namesFromMrzLine(nameLine);
    if (raw.split(' ').filter(Boolean).length > fields.fullName.split(' ').filter(Boolean).length) {
      fields.fullName = raw;
    }
    const perField = ((best.parsed.details ?? []) as MrzDetail[])
      .filter((d) => d.field.endsWith('CheckDigit'))
      .map((d) => ({ key: d.field, value: String(d.value ?? ''), valid: !!d.valid }));
    const warnings: string[] = [];
    if (best.conf < 60) warnings.push('low_confidence');
    warnings.push(...expiryWarnings(fields.passportExpiry));
    return { confidence: best.conf, fields, perField, format: best.parsed.format ?? '', rawMrz: best.lines, warnings };
  }

  /** MRZ read → API result. `bands`: full-frame and/or bottom-band crop. */
  private async run(file: Buffer, ocr: OcrFn, bands: boolean[] = [false], earlyExitConf?: number): Promise<PassportScanResult> {
    return this.mrzToResult(await this.findBestMrz(file, ocr, bands, earlyExitConf));
  }

  /** Scan the BACK of an ID card → TD1 MRZ fields (name is ignored by callers — taken from front). */
  async scanIdBack(file: Buffer, ocr?: OcrFn): Promise<PassportScanResult> {
    file = await this.toImage(file);
    // Try the cropped MRZ band first (that is where the ID-back MRZ reads cleanly), full frame as
    // a fallback (e.g. the card small in frame). PSM 4 (single column of variable-size text) reads
    // the cropped MRZ block far better than the default layout analysis.
    if (ocr) return this.run(file, ocr, [true, false], 90);
    return ocrGate.run(async () => {
      const mrz = await this.makeScheduler(OCR_LANG, MRZ_POOL, { tessedit_char_whitelist: MRZ_WHITELIST, tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
      try {
        return await this.run(file, mrz.ocr, [true, false], 90);
      } finally {
        await mrz.terminate();
      }
    });
  }

  /**
   * Scan an ID card (front + back) → merged fields. `mrzOcr` reads the back MRZ (mrz model),
   * `textOcr` reads the printed front/back text (eng model). Inject both in tests.
   */
  async scanIdCard(front: Buffer, back: Buffer, mrzOcr?: OcrFn, textOcr?: OcrFn): Promise<PassportScanResult> {
    [front, back] = await Promise.all([this.toImage(front), this.toImage(back)]);
    if (mrzOcr && textOcr) return this.mergeId(front, back, mrzOcr, textOcr);
    return ocrGate.run(async () => {
    // mrz pool (all orientations parallel) + eng pool (front & back read in parallel), created together.
    const [mrz, text] = await Promise.all([
      this.makeScheduler(OCR_LANG, MRZ_POOL, { tessedit_char_whitelist: MRZ_WHITELIST, tessedit_pageseg_mode: PSM.SINGLE_COLUMN }),
      this.makeScheduler('eng', TEXT_POOL),
    ]);
    try {
      return await this.mergeId(front, back, mrz.ocr, text.ocr);
    } finally {
      await Promise.all([mrz.terminate(), text.terminate()]);
    }
    });
  }

  private async mergeId(front: Buffer, back: Buffer, mrzOcr: OcrFn, textOcr: OcrFn): Promise<PassportScanResult> {
    // Back MRZ (mrz pool, orientations parallel) + both VIZ text reads (eng pool) all run concurrently.
    const [backMrz, frontText, backText] = await Promise.all([
      this.scanIdBack(back, mrzOcr),
      (async () => textOcr(await this.preprocessViz(front)))(),
      (async () => textOcr(await this.preprocessViz(back)))(),
    ]);
    const texts = { frontText, backText };
    const merged = mergeIdResult(backMrz, extractIdFront(texts.frontText), extractIdBackViz(texts.backText));
    if (backMrz.warnings.includes('mrz_not_found')) {
      merged.warnings = [...merged.warnings.filter((w) => w !== 'mrz_not_found'), 'id_back_mrz_not_found'];
    }
    return merged;
  }

  /**
   * Scan a vehicle-registration certificate (tex passport): front + back printed sides → AUTO
   * collateral fields. No MRZ, so it OCRs each side (eng) at all 4 orientations, keeps the text with
   * the most numbered anchors, and parses the numbered fields. Inject `ocr` in tests.
   */
  async scanTex(front: Buffer, back: Buffer, ocr?: OcrFn): Promise<TexScanResult> {
    [front, back] = await Promise.all([this.toImage(front), this.toImage(back)]);
    // Front needs a higher-res orientation scout than the back (see bestTexFields).
    if (ocr) {
      const [ff, bf] = await Promise.all([this.bestTexFields(front, ocr, 1800), this.bestTexFields(back, ocr, 1200)]);
      return extractTexFromFields(ff.fields, bf.fields, ff.text, bf.text);
    }
    return ocrGate.run(async () => {
      // eng pool (OCR_WORKERS) so the parallel OCR passes run concurrently; front + back are scanned
      // together. The gate ensures only one such burst runs at a time per replica.
      const eng = await this.makeScheduler('eng', TEX_WORKERS);
      try {
        const [ff, bf] = await Promise.all([this.bestTexFields(front, eng.ocr, 1800), this.bestTexFields(back, eng.ocr, 1200)]);
        return extractTexFromFields(ff.fields, bf.fields, ff.text, bf.text);
      } finally {
        await eng.terminate();
      }
    });
  }

  /**
   * Two-phase:
   *  (1) ROTATION CHECK — OCR all 4 orientations IN PARALLEL at `scoutWidth` and keep the one that reads
   *      the most numbered fields (they only line up when the side is upright).
   *  (2) REFINE — at the winning orientation, OCR 4 size/threshold variants and merge. Different variants
   *      recover different fields (model / colour / owner), so the union is the fullest read.
   * Scout width matters and differs by side (verified locally): the DENSE back (fields 9–19) orients
   * reliably at 1200px and TIES/mis-picks at higher res; the SPARSE front (fields 1–8, over a denser
   * security pattern) needs 1800px to pick the right angle — at 1200 it mis-picks and drops the whole
   * side. So scanTex passes front=1800, back=1200 (tex-2: 33% → 67%, tex-1 unchanged).
   */
  private async bestTexFields(file: Buffer, ocr: OcrFn, scoutWidth = 1200): Promise<{ fields: Map<number, string>; text: string }> {
    // Score: numbered fields dominate (they only appear when upright); alnum count breaks near-ties.
    const score = (t: string) => numberedFields(t).size * 1000 + (t.match(/[A-Za-z0-9]/g)?.length ?? 0);
    const scouts = await Promise.all(ORIENTATIONS.map(async (a) => ({ a, text: await ocr(await this.preprocessTex(file, a, 0, scoutWidth)) })));
    const best = scouts.reduce((b, s) => (score(s.text) > score(b.text) ? s : b));
    // width × threshold × CLAHE. The last is a CLAHE (local-contrast) pass — it lifts faint printed
    // text on washed-out / unevenly-lit scans, recovering the low-contrast owner name + region that a
    // global normalize misses (verified: it reads "SHAKIROV"/"TOSHKENT" the others can't).
    const variants: Array<[number, number, boolean]> = [[2600, 0, false], [2600, 150, false], [2400, 120, false], [2600, 0, true]];
    const extra = await Promise.all(variants.map(async ([w, t, cl]) => ocr(await this.preprocessTex(file, best.a, t, w, cl))));
    const fields = mergeFields([numberedFields(best.text), ...extra.map(numberedFields)]);
    return { fields, text: [best.text, ...extra].join('\n') };
  }

  /** Preprocess a tex-passport side: rotate + grayscale + normalize + sharpen (+ optional threshold),
   *  upscaled so the small numbered print (over a security pattern) is legible to eng. threshold 0 = none.
   *  `clahe` adds contrast-limited adaptive histogram equalization (local contrast) for faded scans. */
  private async preprocessTex(file: Buffer, angle: number, threshold = 0, width = 2600, clahe = false): Promise<Buffer> {
    let img: sharp.Sharp;
    if (clahe) {
      // CLAHE needs an 8-bit single-channel image — materialise grayscale first, then equalise. If
      // libvips rejects the input, fall back to plain grayscale (best-effort, never fails the scan).
      const base = await sharp(file, { failOn: 'none' }).rotate(angle).grayscale().toColourspace('b-w').toBuffer();
      try { img = sharp(base).clahe({ width: 80, height: 80, maxSlope: 5 }); } catch { img = sharp(base); }
    } else {
      img = sharp(file, { failOn: 'none' }).rotate(angle).grayscale();
    }
    img = img.normalize().sharpen();
    if (threshold > 0) img = img.threshold(threshold);
    return img.resize({ width }).toBuffer();
  }

  /** Preprocess the printed (VIZ) side for the eng text OCR: the labels/values are large and upright,
   *  so grayscale/normalize/sharpen at ~1300px reads cleanly and fast (bigger only adds latency). */
  private async preprocessViz(file: Buffer, angle = 0, width = 1300): Promise<Buffer> {
    return sharp(file, { failOn: 'none' }).rotate(angle).grayscale().normalize().sharpen().resize({ width }).toBuffer();
  }

  /** Rotate + grayscale + normalize + sharpen (+ optional threshold/band crop) + upscale. */
  private async preprocess(file: Buffer, angle: number, binarize: boolean, cropBand = false): Promise<Buffer> {
    let img = sharp(file, { failOn: 'none' }).rotate(angle).grayscale().normalize().sharpen();
    if (binarize) img = img.threshold(140);
    if (cropBand) {
      // The ID-back MRZ sits at the bottom over a security pattern; crop the bottom band (drops the
      // QR/chip/hologram noise that shifts the lines) at FULL resolution, THEN upscale the band to
      // ~1600px — far bigger OCR-B glyphs than cropping a pre-shrunk image. Materialize first so
      // metadata reflects the applied rotation (metadata() on a lazy .rotate() returns input dims).
      const base = await img.toBuffer();
      const meta = await sharp(base).metadata();
      const h = meta.height ?? 0;
      if (h > 0) {
        const top = Math.round(h * 0.66);
        return sharp(base).extract({ left: 0, top, width: meta.width ?? 1, height: h - top }).resize({ width: 1600 }).toBuffer();
      }
      return sharp(base).resize({ width: 1600 }).toBuffer();
    }
    // Upscale small scans too: a rotated phone photo often leaves the MRZ only ~800px wide, which
    // tesseract reads poorly. Targeting ~1600px gives it legible OCR-B glyphs.
    return img.resize({ width: 1600 }).toBuffer();
  }
}
