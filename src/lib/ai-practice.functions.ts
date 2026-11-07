import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateResponse, GatewayError, PaymentRequiredError, RateLimitError } from "@lovable.dev/ai-gateway";
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
        required: ["stimulus", "question", "options", "correctIndex", "hints", "explanation", "steps", "concept"],
        properties: {
          stimulus: { type: "string" },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correctIndex: { type: "integer" },
          hints: { type: "array", items: { type: "string" } },
          explanation: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
          concept: { type: "string" },
        },
      },
    },
  },
} as const;

export const generatePractice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parsePracticeInput)
  .handler(async ({ data }): Promise<{ questions: PracticeQuestion[]; error?: string }> => {
    const prompt = `Buat ${data.count} soal latihan pilihan ganda (4 opsi) dalam Bahasa Indonesia.
Mata pelajaran: ${data.subject}
Topik: ${data.topic}
Tingkat kesulitan: ${LEVEL_TEXT[data.level]}
${data.notes ? `Catatan/rangkuman materi dari pengguna (jadikan rujukan utama):\n"""${data.notes}"""` : ""}
${data.file ? "Gunakan juga lampiran materi sebagai rujukan." : ""}

Aturan setiap soal:
- "stimulus": teks/konteks pendukung bila perlu, kosongkan "" bila tidak ada.
- "question": pertanyaan yang jelas.
- "options": tepat 4 opsi tanpa awalan huruf, hanya satu benar; "correctIndex" 0-3, acak posisinya.
- "hints": 3 petunjuk bertahap dari samar ke spesifik, JANGAN menyebut jawaban.
- "explanation": penjelasan konsep singkat mengapa jawaban benar dan kesalahan umum.
- "steps": 2-5 langkah penyelesaian.
- "concept": nama konsep/indikator yang diuji (singkat).
Kembalikan JSON.`;

    const content: any[] = [{ type: "input_text", text: prompt }];
    if (data.file) {
      if (data.file.mime.startsWith("image/")) {
        content.push({ type: "input_image", image_url: data.file.dataUrl, detail: "auto" });
      } else {
        content.push({ type: "input_file", file_data: data.file.dataUrl, filename: data.file.name });
      }
    }

    const geminiKey = process.env.GOOGLE_API_KEY;
    if (geminiKey) {
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
              systemInstruction: { parts: [{ text: "Kamu adalah tutor dan penyusun soal yang teliti untuk sekolah di Indonesia. Pastikan setiap kunci jawaban benar secara faktual." }] },
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
    }

    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: "Kamu adalah tutor dan penyusun soal yang teliti untuk sekolah di Indonesia. Pastikan setiap kunci jawaban benar secara faktual.",
        input: [{ type: "message", role: "user", content }],
        text: { format: { type: "json_schema", name: "practice_set", strict: true, schema: SCHEMA as any } },
      });
      const text = ((res as any).output ?? [])
        .filter((o: any) => o.type === "message")
        .flatMap((o: any) => o.content ?? [])
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text)
        .join("");
      const questions = normalizePracticeQuestions(JSON.parse(text || "{}"));
      if (!questions.length) return { questions: [], error: "AI belum menghasilkan soal yang valid. Coba lagi." };
      return { questions: questions.slice(0, data.count) };
    } catch (e) {
      if (e instanceof PaymentRequiredError) return { questions: [], error: "Kredit AI habis. Hubungi admin untuk menambah kredit." };
      if (e instanceof RateLimitError) return { questions: [], error: "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi." };
      if (e instanceof GatewayError) console.error("generatePractice", e.code, e.ids);
      else console.error("generatePractice", e);
      return { questions: [], error: "Gagal membuat soal. Coba lagi sebentar lagi." };
    }
  });
