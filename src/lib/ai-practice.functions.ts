import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parsePracticeInput, normalizePracticeQuestions, type PracticeQuestion } from "./ai-practice";

const LEVEL_TEXT = {
  dasar: "Dasar (konsep inti, langsung, cocok untuk pemula/remedial)",
  menengah: "Menengah (penerapan konsep, perlu 1-2 langkah berpikir)",
  mahir: "Mahir (analisis/HOTS, multi-langkah, cocok untuk pengayaan)",
} as const;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "stimulus", "question", "options", "correctIndex", "correctIndices", "statements", "hints", "explanation", "steps", "concept"],
        properties: {
          type: { type: "string", enum: ["multiple_choice", "complex_multiple_choice", "statement_table"] },
          stimulus: { type: "string" },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correctIndex: { type: "integer" },
          correctIndices: { type: "array", items: { type: "integer" } },
          statements: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "answer"],
              properties: { text: { type: "string" }, answer: { type: "boolean" } },
            },
          },
          hints: { type: "array", items: { type: "string" } },
          explanation: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
          concept: { type: "string" },
        },
      },
    },
  },
} as const;

function buildPrompt(data: ReturnType<typeof parsePracticeInput>) {
  return `Buat ${data.count} soal Latihan Literasi interaktif dalam Bahasa Indonesia.
Mata pelajaran: ${data.subject}
Topik: ${data.topic}
Tingkat kesulitan: ${LEVEL_TEXT[data.level]}
${data.notes ? `Catatan/rangkuman materi dari pengguna (jadikan rujukan utama):\n"""${data.notes}"""` : ""}
${data.file ? "Gunakan juga lampiran materi sebagai rujukan." : ""}

Variasikan tiga bentuk soal berikut. Jika jumlah soal minimal 3, WAJIB ada ketiga bentuk dan susun bergantian: multiple_choice, complex_multiple_choice, statement_table, lalu ulangi urutan tersebut. Jika 2 soal, gunakan dua bentuk berbeda.

Aturan umum setiap soal:
- "stimulus": bacaan, data, atau konteks pendukung yang cukup untuk menjawab; kosongkan "" hanya bila benar-benar tidak diperlukan.
- "question": instruksi/pertanyaan yang jelas dan terpisah dari stimulus.
- "hints": 3 petunjuk bertahap dari samar ke spesifik, JANGAN menyebut jawaban.
- "explanation": pembahasan konsep dan alasan kunci jawaban, termasuk kesalahan umum.
- "steps": 2-5 langkah penyelesaian.
- "concept": nama konsep/indikator yang diuji (singkat).

Aturan berdasarkan "type":
1. multiple_choice (Pilihan Ganda): "options" tepat 4 opsi tanpa awalan huruf, hanya satu benar; "correctIndex" 0-3 dengan posisi kunci bervariasi; "correctIndices" []; "statements" [].
2. complex_multiple_choice (Pilihan Ganda Kompleks): "options" 4-5 opsi tanpa awalan huruf dan minimal 2 jawaban benar; "correctIndices" berisi semua indeks jawaban benar, diurutkan naik; "correctIndex" -1; "statements" []. Instruksikan siswa memilih semua jawaban yang tepat.
3. statement_table (Tabel Pernyataan): "statements" berisi 3-5 pernyataan yang masing-masing dapat dinilai independen, dalam bentuk {"text":"pernyataan", "answer":true/false}; answer true berarti Benar dan false berarti Salah. Variasikan kunci Benar/Salah. "options" [], "correctIndex" -1, "correctIndices" []. Instruksikan siswa menentukan Benar atau Salah untuk setiap pernyataan.

Pastikan semua kunci benar secara faktual dan tidak ambigu. Kembalikan JSON sesuai skema.`;
}

export const generatePractice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parsePracticeInput)
  .handler(async ({ data }): Promise<{ questions: PracticeQuestion[]; error?: string }> => {
    const prompt = buildPrompt(data);
    const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!geminiKey) return { questions: [], error: "Fitur AI belum aktif. Admin perlu mengisi GOOGLE_API_KEY (Gemini)." };
    try {
      const parts: any[] = [{ text: prompt }];
      if (data.file) {
        const [, b64 = ""] = data.file.dataUrl.split(",");
        parts.push({ inline_data: { mime_type: data.file.mime, data: b64 } });
      }
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: "Kamu adalah tutor dan penyusun soal Latihan Literasi yang teliti untuk sekolah di Indonesia. Pastikan setiap kunci jawaban benar secara faktual." }] },
            contents: [{ role: "user", parts }],
            generationConfig: { responseMimeType: "application/json", responseJsonSchema: SCHEMA },
          }),
        },
      );
      if (r.status === 429) return { questions: [], error: "Kuota Gemini sedang penuh. Tunggu sebentar lalu coba lagi." };
      if (r.status === 400 || r.status === 401 || r.status === 403) {
        console.error("gemini", r.status, await r.text());
        return { questions: [], error: "API key Gemini ditolak. Periksa kembali key-nya." };
      }
      if (!r.ok) throw new Error(`gemini ${r.status}: ${await r.text()}`);
      const j: any = await r.json();
      const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
      const questions = normalizePracticeQuestions(JSON.parse(text || "{}"));
      if (!questions.length) return { questions: [], error: "AI belum menghasilkan soal yang valid. Coba lagi." };
      return { questions: questions.slice(0, data.count) };
    } catch (e) {
      console.error("generatePractice gemini", e);
      return { questions: [], error: "Gagal membuat soal. Coba lagi sebentar lagi." };
    }
  });
