// Parse questions pasted from an AI chat (Gemini / ChatGPT / etc.) into Bank Soal items.
// Supports two shapes:
//  1) JSON array  [{ "question": "...", "options": ["..."], "answer": "B", "type": "multiple_choice" }]
//  2) Plain numbered text with A-E options and an answer line ("Jawaban: B" / "Answer: B").
import { emptyQ, type BQ, type BType } from "@/components/question-fields";

export type ParseResult = { questions: BQ[]; warnings: string[] };

/** Prompt the teacher can copy into any AI so the output is import-ready. */
export const AI_PROMPT_TEMPLATE = `Buatkan 10 soal [MATA PELAJARAN] untuk [KELAS] dengan format PERSIS seperti contoh di bawah (jangan tambah penjelasan lain):

1. Apa ibu kota Indonesia?
A. Bandung
B. Jakarta
C. Surabaya
D. Medan
Jawaban: B
Tingkat: mudah

2. Jelaskan proses fotosintesis secara singkat.
Tipe: esai
Jawaban: -
Tingkat: sedang

Catatan format:
- Nomor soal diawali angka dan titik.
- Pilihan jawaban pakai huruf A., B., C., D. (maksimal E).
- Baris "Jawaban:" wajib untuk pilihan ganda (boleh lebih dari satu huruf, mis. "Jawaban: A, C").
- Untuk soal isian singkat tulis "Tipe: isian" dan "Jawaban: <jawaban benar>".
- Untuk esai tulis "Tipe: esai".
- Baris "Tingkat:" opsional (mudah / sedang / sulit).`;

const DIFF_MAP: Record<string, string> = {
  mudah: "easy", easy: "easy", ringan: "easy",
  sedang: "medium", medium: "medium", menengah: "medium",
  sulit: "hard", hard: "hard", sukar: "hard", susah: "hard",
};

function normDifficulty(v: string | undefined): string {
  const s = (v ?? "").trim().toLowerCase();
  return DIFF_MAP[s] ?? "medium";
}

function normType(v: string | undefined, optionCount: number, multi: boolean): BType {
  const s = (v ?? "").trim().toLowerCase();
  if (/esai|essay|uraian/.test(s)) return "essay";
  if (/isian|short|singkat/.test(s)) return "short_answer";
  if (/benar|salah|true|false/.test(s)) return "true_false";
  if (/audio|voice|rekam/.test(s)) return "voice";
  if (/foto|gambar|image/.test(s)) return "image";
  if (/kompleks|complex|multi/.test(s)) return "complex_multiple_choice";
  if (/pilihan|multiple/.test(s)) return multi ? "complex_multiple_choice" : "multiple_choice";
  if (optionCount >= 2) return multi ? "complex_multiple_choice" : "multiple_choice";
  return "essay";
}

const letterIndex = (l: string) => l.toUpperCase().charCodeAt(0) - 65;

/** Turn an "answer" value into indices when it points at option letters/text. */
function resolveAnswer(answer: string, options: string[]): { indices: number[]; text: string } {
  const raw = answer.trim();
  if (!raw || raw === "-") return { indices: [], text: "" };
  const letters = raw
    .split(/[,;/&]|\bdan\b|\band\b/i)
    .map((p) => p.trim())
    .map((p) => p.match(/^\(?([A-Ea-e])\)?[.)]?$/)?.[1])
    .filter(Boolean) as string[];
  if (letters.length && options.length) {
    const idx = letters.map(letterIndex).filter((i) => i >= 0 && i < options.length);
    if (idx.length) return { indices: idx, text: raw };
  }
  // Match against option text
  const hit = options.findIndex((o) => o.trim() && o.trim().toLowerCase() === raw.toLowerCase());
  if (hit >= 0) return { indices: [hit], text: raw };
  return { indices: [], text: raw };
}

function makeQ(input: {
  question: string;
  options?: string[];
  answer?: string;
  type?: string;
  difficulty?: string;
  topic?: string;
}): BQ | null {
  const question = (input.question ?? "").trim();
  const options = (input.options ?? []).map((o) => String(o ?? "").trim()).filter(Boolean);
  if (!question) return null;

  const answerRaw = String(input.answer ?? "").trim();
  const { indices, text } = resolveAnswer(answerRaw, options);
  const multi = indices.length > 1;
  const type = normType(input.type, options.length, multi);

  const q = emptyQ(type);
  q.question = question;
  q.topic = (input.topic ?? "").trim();
  q.difficulty = normDifficulty(input.difficulty);

  if (type === "true_false") {
    q.options = ["Benar", "Salah"];
    q.correctIndex = /salah|false/i.test(answerRaw) ? 1 : 0;
    q.correctIndices = [q.correctIndex];
    return q;
  }
  if (type === "multiple_choice" || type === "complex_multiple_choice") {
    const opts = options.length >= 2 ? options : ["", "", "", ""];
    q.options = opts.length < 2 ? ["", "", "", ""] : opts;
    q.correctIndex = indices[0] ?? 0;
    q.correctIndices = indices.length ? indices : [];
    return q;
  }
  if (type === "short_answer") {
    q.answer = text && text !== "-" ? text : "";
    return q;
  }
  return q;
}

function parseJson(text: string): ParseResult | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  if (!(trimmed.startsWith("[") || trimmed.startsWith("{"))) return null;
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const arr = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.questions)
      ? (data as any).questions
      : null;
  if (!arr) return null;
  const warnings: string[] = [];
  const questions: BQ[] = [];
  arr.forEach((item: any, i: number) => {
    const q = makeQ({
      question: item?.question ?? item?.soal ?? item?.pertanyaan ?? "",
      options: item?.options ?? item?.pilihan ?? item?.choices ?? [],
      answer: item?.answer ?? item?.jawaban ?? item?.correct ?? "",
      type: item?.type ?? item?.tipe ?? "",
      difficulty: item?.difficulty ?? item?.tingkat ?? item?.kesulitan ?? "",
      topic: item?.topic ?? item?.topik ?? "",
    });
    if (q) questions.push(q);
    else warnings.push(`Item ${i + 1} dilewati (tanpa teks soal).`);
  });
  return { questions, warnings };
}

const NUM_RE = /^\s*(?:soal\s*)?(\d{1,3})\s*[.)\]:-]\s*(.*)$/i;
const OPT_RE = /^\s*\(?([A-Ea-e])\)?\s*[.):-]\s*(.+)$/;
const ANS_RE = /^\s*(?:jawaban|jawapan|answer|kunci(?:\s*jawaban)?)\s*[:.-]\s*(.*)$/i;
const TYPE_RE = /^\s*(?:tipe|type|jenis)\s*[:.-]\s*(.*)$/i;
const DIFF_RE = /^\s*(?:tingkat|difficulty|level|kesulitan)\s*[:.-]\s*(.*)$/i;
const TOPIC_RE = /^\s*(?:topik|topic|materi)\s*[:.-]\s*(.*)$/i;

type Draft = { question: string; options: string[]; answer: string; type: string; difficulty: string; topic: string };
const newDraft = (question: string): Draft => ({ question, options: [], answer: "", type: "", difficulty: "", topic: "" });

function parseText(text: string): ParseResult {
  const lines = text.replace(/\r/g, "").split("\n");
  const drafts: Draft[] = [];
  let cur: Draft | null = null;
  const warnings: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/^\s*[*•-]\s+/, (m) => (OPT_RE.test(rawLine.trim()) ? m : "")).trim();
    if (!line) continue;

    const num = line.match(NUM_RE);
    // A numbered line starts a new question — but only when it isn't an option line.
    if (num && !OPT_RE.test(line)) {
      if (cur) drafts.push(cur);
      cur = newDraft((num[2] ?? "").trim());
      continue;
    }
    if (!cur) {
      // Free text before the first number: treat as the first question prompt.
      cur = newDraft(line);
      continue;
    }

    const ans = line.match(ANS_RE);
    if (ans) { cur.answer = (ans[1] ?? "").trim(); continue; }
    const ty = line.match(TYPE_RE);
    if (ty) { cur.type = (ty[1] ?? "").trim(); continue; }
    const df = line.match(DIFF_RE);
    if (df) { cur.difficulty = (df[1] ?? "").trim(); continue; }
    const tp = line.match(TOPIC_RE);
    if (tp) { cur.topic = (tp[1] ?? "").trim(); continue; }

    const opt = line.match(OPT_RE);
    if (opt) {
      const idx = letterIndex(opt[1]!);
      const value = (opt[2] ?? "").trim();
      // Fill in order; ignore out-of-range letters.
      if (idx >= 0 && idx <= 4) {
        while (cur.options.length < idx) cur.options.push("");
        cur.options[idx] = value;
      }
      continue;
    }

    // Continuation of the question text.
    cur.question = cur.question ? `${cur.question} ${line}` : line;
  }
  if (cur) drafts.push(cur);

  const questions: BQ[] = [];
  drafts.forEach((d, i) => {
    const q = makeQ(d);
    if (q) questions.push(q);
    else warnings.push(`Soal ${i + 1} dilewati (teks kosong).`);
  });
  return { questions, warnings };
}

/** Parse pasted AI output (JSON or plain text) into Bank Soal question drafts. */
export function parseQuestions(text: string): ParseResult {
  if (!text.trim()) return { questions: [], warnings: [] };
  const asJson = parseJson(text);
  if (asJson && asJson.questions.length) return asJson;
  return parseText(text);
}
