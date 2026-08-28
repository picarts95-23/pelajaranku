// Parse teaching documents pasted from an AI chat (Gemini / ChatGPT / etc.)
// into Prota/Prosem rows, RPP entries, and Jurnal entries.
// Every parser accepts either a JSON array or plain labelled/tabular text,
// and the parsed result is only ever a *draft* — teachers still edit & save.

export type ImportProgramItem = {
  material: string;
  hours: string;
  semester?: string;
  month?: string;
  weeks?: string;
  note?: string;
};

export type ImportRppEntry = {
  week_label: string;
  subject?: string;
  start_date?: string;
  end_date?: string;
  objectives: string;
  materials?: string;
  methods?: string;
  media?: string;
  assessment?: string;
  notes?: string;
};

export type ImportJournalEntry = {
  date?: string;
  subject?: string;
  topic: string;
  notes?: string;
};

export const MONTHS_ID = [
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
];

/* ------------------------------------------------------------------ prompts */

export const PROMPT_PROTA = `Buatkan Program Tahunan untuk mata pelajaran [MATA PELAJARAN] kelas [KELAS] tahun ajaran [TAHUN].
Tulis HANYA tabel dengan pemisah tanda "|" seperti contoh (tanpa penjelasan lain):

Semester | Materi/Kompetensi | Alokasi Jam | Keterangan
1 | Bilangan bulat dan operasinya | 8 | asesmen awal
1 | Pecahan dan perbandingan | 6 |
2 | Aljabar dasar | 8 | proyek kelompok`;

export const PROMPT_PROSEM = `Buatkan Program Semester [1/2] mata pelajaran [MATA PELAJARAN] kelas [KELAS].
Tulis HANYA tabel dengan pemisah tanda "|" seperti contoh (tanpa penjelasan lain):

Bulan | Pekan | Materi/Kompetensi | Alokasi Jam | Keterangan
Juli | 1,2 | Bilangan bulat | 4 | asesmen awal
Agustus | 3 | Pecahan | 4 |`;

export const PROMPT_RPP = `Buatkan [JUMLAH] RPP pekanan mata pelajaran [MATA PELAJARAN] kelas [KELAS].
Tulis PERSIS dengan label berikut, pisahkan tiap RPP dengan baris "---":

Pekan: Pekan 1 — Bilangan Bulat
Mulai: 2026-07-13
Selesai: 2026-07-19
Tujuan: Siswa mampu menjelaskan operasi bilangan bulat.
Materi: Penjumlahan & pengurangan bilangan bulat
Metode: Diskusi kelompok, latihan soal
Media: Papan tulis, kartu bilangan
Penilaian: Kuis 10 soal, observasi keaktifan
Catatan: -
---
Pekan: Pekan 2 — ...`;

export const PROMPT_JURNAL = `Buatkan [JUMLAH] jurnal mengajar mata pelajaran [MATA PELAJARAN].
Tulis PERSIS dengan label berikut, pisahkan tiap jurnal dengan baris "---":

Tanggal: 2026-07-14
Topik: Operasi bilangan bulat
Catatan: Siswa antusias, 3 siswa perlu pendampingan tambahan.
---
Tanggal: 2026-07-16
Topik: ...
Catatan: ...`;

/* -------------------------------------------------------------- primitives */

const clean = (s: string) =>
  s.replace(/^[*#>\-\s]+/, "").replace(/\*\*/g, "").replace(/\s+$/, "").trim();

function tryJson(text: string): any[] | null {
  const t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  if (!t.startsWith("[") && !t.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(t);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const arr = (parsed as any).items ?? (parsed as any).data ?? (parsed as any).rows;
      if (Array.isArray(arr)) return arr;
      return [parsed];
    }
  } catch {
    return null;
  }
  return null;
}

/** Split a text row on |, tab, or ; separators. */
function cells(line: string): string[] {
  const raw = line.includes("|") ? line.split("|") : line.includes("\t") ? line.split("\t") : line.split(";");
  return raw.map((c) => clean(c)).filter((_, i, a) => !(i === 0 && a.length > 1 && a[0] === ""));
}

const isHeaderRow = (c: string[]) =>
  c.some((x) => /^(semester|smt|bulan|pekan|materi|kompetensi|alokasi|jam|keterangan|no)\.?$/i.test(x));

const digits = (s: string) => (s.match(/\d+/g) ?? []).join(",");
const firstNumber = (s: string) => (s.match(/\d+(?:[.,]\d+)?/) ?? [""])[0].replace(",", ".");

const matchMonth = (s: string) => MONTHS_ID.find((m) => new RegExp(m, "i").test(s)) ?? "";

/** Normalise a date-ish string to yyyy-mm-dd, or "" when unknown. */
function normDate(v: string | undefined): string {
  const s = (v ?? "").trim();
  if (!s) return "";
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const dmy = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const named = s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (named) {
    const idx = MONTHS_ID.findIndex((m) => m.toLowerCase().startsWith(named[2].slice(0, 3).toLowerCase()));
    const monthNo = idx >= 0 ? ((idx + 6) % 12) + 1 : NaN;
    if (!Number.isNaN(monthNo)) return `${named[3]}-${String(monthNo).padStart(2, "0")}-${named[1].padStart(2, "0")}`;
  }
  return "";
}

/**
 * Parse "Label: value" blocks, keeping multi-line values until the next label.
 * Blocks are separated by `---` or a blank line followed by the first label again.
 */
function labelBlocks(text: string, labels: RegExp): Record<string, string>[] {
  const chunks = text
    .split(/^\s*(?:-{3,}|={3,}|\*{3,})\s*$/m)
    .flatMap((chunk) => chunk.trim())
    .filter(Boolean);

  const out: Record<string, string>[] = [];
  for (const chunk of chunks) {
    let current: Record<string, string> = {};
    let key = "";
    for (const rawLine of chunk.split(/\r?\n/)) {
      const line = clean(rawLine);
      const m = line.match(/^([A-Za-z'’\s/&]+)\s*[:：]\s*(.*)$/);
      if (m && labels.test(m[1].trim())) {
        const k = m[1].trim().toLowerCase();
        // A repeated first-label starts a new entry.
        if (k in current && Object.keys(current).length > 1) {
          out.push(current);
          current = {};
        }
        key = k;
        current[key] = m[2].trim();
      } else if (key && line) {
        current[key] = `${current[key]}\n${line}`.trim();
      }
    }
    if (Object.keys(current).length) out.push(current);
  }
  return out;
}

const pick = (o: Record<string, string>, re: RegExp) => {
  const k = Object.keys(o).find((key) => re.test(key));
  return k ? o[k].trim() : "";
};

/* ------------------------------------------------------- Prota / Prosem */

export function parseProgramItems(
  text: string,
  kind: "annual" | "semester",
): { items: ImportProgramItem[]; warnings: string[] } {
  const warnings: string[] = [];
  const json = tryJson(text);

  if (json) {
    const items = json
      .map((r: any) => ({
        material: String(r.material ?? r.materi ?? r.kompetensi ?? r.topic ?? "").trim(),
        hours: String(r.hours ?? r.jam ?? r.alokasi ?? "").trim(),
        semester: kind === "annual" ? String(r.semester ?? r.smt ?? "1").replace(/\D/g, "") || "1" : undefined,
        month: kind === "semester" ? (matchMonth(String(r.month ?? r.bulan ?? "")) || MONTHS_ID[0]) : undefined,
        weeks: kind === "semester" ? digits(String(r.weeks ?? r.pekan ?? "")) : undefined,
        note: String(r.note ?? r.keterangan ?? "").trim(),
      }))
      .filter((r) => r.material);
    if (!items.length) warnings.push("JSON terbaca, tetapi tidak ada baris dengan kolom materi.");
    return { items, warnings };
  }

  const items: ImportProgramItem[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^[-|=+\s]+$/.test(line)) continue;
    const c = cells(line);
    if (c.length > 1 && isHeaderRow(c)) continue;

    if (c.length >= 2) {
      // Drop a leading pure row-number cell.
      const parts = /^\d+\.?$/.test(c[0]) && c.length >= 3 ? c.slice(1) : c;
      if (kind === "annual") {
        const smtFirst = /^(1|2|i|ii|ganjil|genap)$/i.test(parts[0]);
        const semester = smtFirst ? (/2|ii|genap/i.test(parts[0]) ? "2" : "1") : "1";
        const rest = smtFirst ? parts.slice(1) : parts;
        const material = rest[0] ?? "";
        if (!material) continue;
        items.push({ semester, material, hours: firstNumber(rest[1] ?? ""), note: rest[2] ?? "" });
      } else {
        const monthFirst = matchMonth(parts[0]);
        const month = monthFirst || MONTHS_ID[0];
        const rest = monthFirst ? parts.slice(1) : parts;
        const weeksFirst = /^[\d,\s&–-]+$/.test(rest[0] ?? "") ? digits(rest[0]) : "";
        const rest2 = weeksFirst ? rest.slice(1) : rest;
        const material = rest2[0] ?? "";
        if (!material) continue;
        items.push({ month, weeks: weeksFirst, material, hours: firstNumber(rest2[1] ?? ""), note: rest2[2] ?? "" });
      }
      continue;
    }

    // Fallback: single numbered/bulleted material line ("1. Bilangan bulat (4 jam)").
    const single = line.match(/^(?:\d+[.)]|[-*•])\s*(.+)$/);
    if (single) {
      const body = clean(single[1]);
      const hours = (body.match(/(\d+)\s*(?:jp|jam|hours?)/i) ?? ["", ""])[1];
      const material = body.replace(/\(?\s*\d+\s*(?:jp|jam|hours?)\s*\)?/i, "").replace(/[·|,\s]+$/, "").trim();
      if (material) {
        items.push(
          kind === "annual"
            ? { semester: "1", material, hours, note: "" }
            : { month: matchMonth(body) || MONTHS_ID[0], weeks: "", material, hours, note: "" },
        );
      }
    }
  }

  if (!items.length) {
    warnings.push('Tidak ada baris yang terbaca. Gunakan format tabel dengan pemisah "|" seperti pada contoh prompt.');
  }
  return { items, warnings };
}

/* ------------------------------------------------------------------- RPP */

const RPP_LABELS = /^(pekan|minggu|judul|topik|mata pelajaran|mapel|subject|mulai|start|tanggal|selesai|end|tujuan|objectives|materi|materials|metode|kegiatan|methods|media|sumber|penilaian|asesmen|assessment|catatan|notes|refleksi)$/i;

export function parseRppEntries(text: string): { entries: ImportRppEntry[]; warnings: string[] } {
  const warnings: string[] = [];
  const json = tryJson(text);

  const fromRecord = (o: Record<string, string>): ImportRppEntry | null => {
    const objectives = pick(o, /tujuan|objective/);
    const label = pick(o, /pekan|minggu|judul|topik/);
    const materials = pick(o, /^materi|material/);
    if (!objectives && !label && !materials) return null;
    return {
      week_label: label || objectives.slice(0, 60),
      subject: pick(o, /mata pelajaran|mapel|subject/) || undefined,
      start_date: normDate(pick(o, /mulai|start|^tanggal/)) || undefined,
      end_date: normDate(pick(o, /selesai|end/)) || undefined,
      objectives: objectives || materials || label,
      materials: materials || undefined,
      methods: pick(o, /metode|kegiatan|method/) || undefined,
      media: pick(o, /media|sumber/) || undefined,
      assessment: pick(o, /penilaian|asesmen|assessment/) || undefined,
      notes: pick(o, /catatan|notes|refleksi/) || undefined,
    };
  };

  const entries: ImportRppEntry[] = json
    ? (json
        .map((r: any) => {
          const flat: Record<string, string> = {};
          Object.entries(r ?? {}).forEach(([k, v]) => { flat[k.toLowerCase()] = String(v ?? ""); });
          return fromRecord(flat);
        })
        .filter(Boolean) as ImportRppEntry[])
    : (labelBlocks(text, RPP_LABELS).map(fromRecord).filter(Boolean) as ImportRppEntry[]);

  if (!entries.length) warnings.push('Tidak ada RPP terbaca. Pastikan ada label "Tujuan:" / "Pekan:" seperti pada contoh prompt.');
  return { entries, warnings };
}

/* ---------------------------------------------------------------- Jurnal */

const JURNAL_LABELS = /^(tanggal|date|topik|topic|materi|judul|mata pelajaran|mapel|subject|catatan|notes|refleksi|keterangan)$/i;

export function parseJournalEntries(text: string): { entries: ImportJournalEntry[]; warnings: string[] } {
  const warnings: string[] = [];
  const json = tryJson(text);

  const fromRecord = (o: Record<string, string>): ImportJournalEntry | null => {
    const topic = pick(o, /topik|topic|^materi|judul/);
    const notes = pick(o, /catatan|notes|refleksi|keterangan/);
    if (!topic && !notes) return null;
    return {
      date: normDate(pick(o, /tanggal|date/)) || undefined,
      subject: pick(o, /mata pelajaran|mapel|subject/) || undefined,
      topic: topic || notes.slice(0, 60),
      notes: notes || undefined,
    };
  };

  let entries: ImportJournalEntry[] = json
    ? (json
        .map((r: any) => {
          const flat: Record<string, string> = {};
          Object.entries(r ?? {}).forEach(([k, v]) => { flat[k.toLowerCase()] = String(v ?? ""); });
          return fromRecord(flat);
        })
        .filter(Boolean) as ImportJournalEntry[])
    : (labelBlocks(text, JURNAL_LABELS).map(fromRecord).filter(Boolean) as ImportJournalEntry[]);

  // Fallback: table rows "2026-07-14 | Topik | Catatan".
  if (!entries.length) {
    entries = text
      .split(/\r?\n/)
      .map((l) => cells(l.trim()))
      .filter((c) => c.length >= 2 && !isHeaderRow(c))
      .map((c) => {
        const d = normDate(c[0]);
        const rest = d ? c.slice(1) : c;
        return { date: d || undefined, topic: rest[0] ?? "", notes: rest[1] ?? undefined };
      })
      .filter((e) => e.topic);
  }

  if (!entries.length) warnings.push('Tidak ada jurnal terbaca. Gunakan label "Tanggal:", "Topik:", "Catatan:" seperti contoh prompt.');
  return { entries, warnings };
}

/* --------------------------------------------------------------- Materi */

export type ImportMaterialEntry = {
  title: string;
  description?: string;
  content?: string;
  link?: string;
  subject?: string;
};

export const PROMPT_MATERI = `Buatkan [JUMLAH] materi pelajaran [MATA PELAJARAN] kelas [KELAS].
Balas HANYA daftar berlabel, pisahkan tiap materi dengan garis "---":

Judul: ...
Mata Pelajaran: ...
Deskripsi: ... (1 kalimat singkat)
Isi: ... (uraian materi, boleh beberapa baris)
Link: ... (opsional, kosongkan jika tidak ada)
---
Judul: ...`;

const MATERI_LABELS = /^(judul|title|materi|topik|topic|mata pelajaran|mapel|subject|deskripsi|description|ringkasan|isi|content|uraian|penjelasan|link|tautan|url)$/i;

export function parseMaterialEntries(text: string): { entries: ImportMaterialEntry[]; warnings: string[] } {
  const warnings: string[] = [];
  const json = tryJson(text);

  const fromRecord = (o: Record<string, string>): ImportMaterialEntry | null => {
    const title = pick(o, /judul|title|^materi$|topik|topic/);
    const content = pick(o, /isi|content|uraian|penjelasan/);
    const description = pick(o, /deskripsi|description|ringkasan/);
    if (!title && !content) return null;
    const link = pick(o, /link|tautan|url/);
    return {
      title: title || content.slice(0, 60),
      description: description || undefined,
      content: content || undefined,
      link: /^https?:\/\//i.test(link) ? link : undefined,
      subject: pick(o, /mata pelajaran|mapel|subject/) || undefined,
    };
  };

  let entries: ImportMaterialEntry[] = json
    ? (json
        .map((r: any) => {
          const flat: Record<string, string> = {};
          Object.entries(r ?? {}).forEach(([k, v]) => { flat[k.toLowerCase()] = String(v ?? ""); });
          return fromRecord(flat);
        })
        .filter(Boolean) as ImportMaterialEntry[])
    : (labelBlocks(text, MATERI_LABELS).map(fromRecord).filter(Boolean) as ImportMaterialEntry[]);

  // Fallback: table rows "Judul | Deskripsi | Isi".
  if (!entries.length) {
    entries = text
      .split(/\r?\n/)
      .map((l) => cells(l.trim()))
      .filter((c) => c.length >= 1 && c[0] && !isHeaderRow(c))
      .map((c) => ({
        title: c[0],
        description: c[1] || undefined,
        content: c[2] || c[1] || undefined,
      }))
      .filter((e) => e.title);
  }

  if (!entries.length) warnings.push('Tidak ada materi terbaca. Gunakan label "Judul:", "Deskripsi:", "Isi:" seperti contoh prompt.');
  return { entries, warnings };
}
