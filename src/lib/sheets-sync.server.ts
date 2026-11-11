// Server-only full teacher backup into each teacher's existing Google Spreadsheet.
// Access/refresh tokens, calendar feed tokens, invite codes, and app secrets are
// deliberately excluded. Media is represented by its stored URL/metadata.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildGradeRecap } from "./sheet-backup-data";
import { fetchAllRows } from "./fetch-all-rows";
import { BACKUP_TAB_TITLES, buildSheetValueBatch, type BackupTabs } from "./sheet-backup-tabs";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";
type AttStatus = "hadir" | "izin" | "sakit" | "alpa";
const DEFAULT_WEIGHTS: Record<AttStatus, number> = { hadir: 100, izin: 50, sakit: 50, alpa: 0 };

function gatewayHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovableKey || !connKey) throw new Error("Google Spreadsheet belum terhubung. Hubungkan akun Google terlebih dahulu.");
  return { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": connKey, "Content-Type": "application/json" };
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

async function rows(query: any, label: string): Promise<any[]> {
  return fetchAllRows((from, to) => query.range(from, to), label);
}

async function one(query: PromiseLike<{ data: any; error: any }>, label: string): Promise<any | null> {
  const { data, error } = await query;
  if (error) throw new Error(`Gagal membaca ${label}: ${error.message}`);
  return data ?? null;
}

async function googleRequest(url: string, headers: Record<string, string>, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Google Sheets [${res.status}]: ${body}`);
    throw new Error(`Google Sheets (${res.status}): ${body.slice(0, 300)}`);
  }
  return res;
}

async function createSpreadsheet(title: string, headers: Record<string, string>) {
  const res = await googleRequest(`${GATEWAY_URL}/spreadsheets`, headers, {
    method: "POST",
    body: JSON.stringify({ properties: { title }, sheets: BACKUP_TAB_TITLES.map((title) => ({ properties: { title } })) }),
  });
  return (await res.json()) as { spreadsheetId: string; spreadsheetUrl: string };
}

async function getExistingTabs(spreadsheetId: string, headers: Record<string, string>): Promise<string[] | null> {
  const res = await fetch(`${GATEWAY_URL}/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gagal membaca spreadsheet (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { sheets?: { properties?: { title?: string } }[] };
  return (json.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
}

async function addMissingTabs(spreadsheetId: string, existing: string[], headers: Record<string, string>) {
  const missing = BACKUP_TAB_TITLES.filter((title) => !existing.includes(title));
  if (!missing.length) return;
  await googleRequest(`${GATEWAY_URL}/spreadsheets/${spreadsheetId}:batchUpdate`, headers, {
    method: "POST",
    body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title } } })) }),
  });
}

async function writeAllTabs(spreadsheetId: string, tabs: BackupTabs, headers: Record<string, string>) {
  const batch = buildSheetValueBatch(tabs);
  const base = `${GATEWAY_URL}/spreadsheets/${spreadsheetId}/values`;
  await googleRequest(`${base}:batchClear`, headers, { method: "POST", body: JSON.stringify({ ranges: batch.clearRanges }) });
  await googleRequest(`${base}:batchUpdate`, headers, {
    method: "POST",
    body: JSON.stringify({ valueInputOption: "RAW", data: batch.data }),
  });
}

async function getTeacherEmail(teacherId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(teacherId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

/** Build every feature tab (name → rows including header) for one teacher. */
async function buildTeacherTabs(teacherId: string): Promise<BackupTabs> {
  const classes = await rows(supabaseAdmin.from("classes").select("id, name, code, description, subject, subjects, academic_year, created_at, updated_at").eq("teacher_id", teacherId).order("created_at"), "kelas");
  const classIds = classes.map((c) => c.id as string);
  const classNameById = new Map(classes.map((c) => [c.id as string, (c.name as string) ?? ""]));
  const cName = (id: unknown) => classNameById.get(id as string) || cell(id);

  const enrollments = classIds.length
    ? await rows(supabaseAdmin.from("class_enrollments").select("id, class_id, student_id, joined_at").in("class_id", classIds), "pendaftaran kelas")
    : [];
  const assignments = await rows(supabaseAdmin.from("assignments").select("id, class_id, assigned_student_id, title, description, subject, exam_type, assessment_kind, halaqoh_kind, answer_format, interactive_mode, question_time_limit, max_score, xp_reward, coin_reward, due_at, objective_id, objective_weights, options, questions, muroja_juz, muroja_surah, muroja_ayat, quiz_link, game_link, attachment_url, attachment_name, attachment_type, created_at, updated_at").eq("teacher_id", teacherId).order("created_at"), "tugas");
  const assignmentIds = assignments.map((a) => a.id as string);
  const assignmentById = new Map(assignments.map((a) => [a.id as string, a]));
  const taskRequests = await rows(supabaseAdmin.from("task_requests").select("id, student_id, class_id, subject, title, description, desired_due_at, status, teacher_note, assignment_id, created_at, responded_at, updated_at").eq("teacher_id", teacherId).order("created_at", { ascending: false }), "permintaan tugas");
  const studentIds = Array.from(new Set([
    ...enrollments.map((e) => e.student_id as string),
    ...assignments.map((a) => a.assigned_student_id as string),
    ...taskRequests.map((r) => r.student_id as string),
  ].filter(Boolean)));

  const [profiles, privates, teacherProfile] = await Promise.all([
    studentIds.length ? rows(supabaseAdmin.from("profiles").select("id, full_name, username, class_name, bio, motto, avatar_url, xp, level, coins, character_key, archived_at, created_at, updated_at").in("id", studentIds), "profil siswa") : Promise.resolve([]),
    studentIds.length ? rows(supabaseAdmin.from("profile_private").select("id, school_id_number, gender, birthdate, hobby").in("id", studentIds), "data pribadi siswa") : Promise.resolve([]),
    one(supabaseAdmin.from("profiles").select("id, full_name").eq("id", teacherId).maybeSingle(), "profil guru"),
  ]);
  const privateById = new Map(privates.map((p) => [p.id, p]));
  const studentNameById = new Map(profiles.map((p) => [p.id as string, (p.full_name as string) ?? ""]));
  const studentNisById = new Map(privates.map((p) => [p.id as string, (p.school_id_number as string) ?? ""]));
  const userName = (id: unknown) => studentNameById.get(id as string) ?? (id === teacherId ? teacherProfile?.full_name ?? "Guru" : cell(id));
  const sMeta = (id: string) => ({ nis: studentNisById.get(id) ?? "", name: userName(id) });
  const primaryClassByStudent = new Map<string, string>();
  for (const e of enrollments) if (!primaryClassByStudent.has(e.student_id)) primaryClassByStudent.set(e.student_id, e.class_id);

  const settings = await one(supabaseAdmin.from("attendance_settings").select("hadir, izin, sakit, alpa, updated_at").eq("teacher_id", teacherId).maybeSingle(), "pengaturan presensi");
  const weights: Record<AttStatus, number> = {
    hadir: clamp(settings?.hadir, DEFAULT_WEIGHTS.hadir), izin: clamp(settings?.izin, DEFAULT_WEIGHTS.izin),
    sakit: clamp(settings?.sakit, DEFAULT_WEIGHTS.sakit), alpa: clamp(settings?.alpa, DEFAULT_WEIGHTS.alpa),
  };
  const attendance = classIds.length
    ? await rows(supabaseAdmin.from("attendance").select("id, class_id, student_id, date, status, note, recorded_by, created_at, updated_at").in("class_id", classIds).order("date"), "presensi")
    : [];
  const submissions = assignmentIds.length
    ? await rows(supabaseAdmin.from("submissions").select("id, assignment_id, student_id, content, file_url, status, score, score_breakdown, feedback, feedback_media_type, feedback_media_url, submitted_at, graded_at, graded_by, reward_granted, created_at, updated_at").in("assignment_id", assignmentIds).order("submitted_at"), "pengumpulan")
    : [];
  const submissionIds = submissions.map((s) => s.id as string);
  const revisions = submissionIds.length
    ? await rows(supabaseAdmin.from("submission_grade_revisions").select("id, submission_id, score, feedback, feedback_media_type, feedback_media_url, status, revised_by, created_at").in("submission_id", submissionIds).order("created_at"), "riwayat revisi nilai")
    : [];

  const [adab, gradeWeights, objectives, practiceAttempts, materials, mutabaah, journals, lessonPlans, annualPrograms, semesterPrograms, answerKeys, teacherSubjects, calendar] = await Promise.all([
    rows(supabaseAdmin.from("adab_scores").select("id, student_id, class_id, subject, score, created_at, updated_at").eq("teacher_id", teacherId), "nilai adab"),
    one(supabaseAdmin.from("grade_weights").select("sumatif, adab, absensi, updated_at").eq("teacher_id", teacherId).maybeSingle(), "bobot nilai"),
    rows(supabaseAdmin.from("learning_objectives").select("id, class_id, subject, code, description, sort_order, created_at, updated_at").eq("teacher_id", teacherId).order("sort_order"), "tujuan pembelajaran"),
    classIds.length ? rows(supabaseAdmin.from("practice_attempts").select("id, client_id, class_id, student_id, subject, topic, level, score, correct_count, question_count, hints_used, feedback, weak_concepts, answers, created_at").in("class_id", classIds).order("created_at", { ascending: false }), "latihan AI") : Promise.resolve([]),
    rows(supabaseAdmin.from("materials").select("id, class_id, subject, title, description, content, link, file_url, media_type, media_url, attachment_url, attachment_name, attachment_type, created_at, updated_at").eq("teacher_id", teacherId).order("created_at"), "materi"),
    rows(supabaseAdmin.from("tahfidz_mutabaah").select("id, student_id, class_id, session_date, session_type, setoran_kind, surah, ayat_from, ayat_to, juz, pages_count, iqro_jilid, iqro_page, iqro_letters, tajwid_score, tajwid_errors, kelancaran_score, kelancaran_helps, fashohah_score, adab_aurat, adab_focus, adab_etika, total_score, predikat, notes, created_at, updated_at").eq("teacher_id", teacherId).order("session_date"), "Mutaba'ah"),
    rows(supabaseAdmin.from("journals").select("id, date, class_id, student_id, subject, topic, notes, created_at, updated_at").eq("teacher_id", teacherId).order("date"), "jurnal"),
    rows(supabaseAdmin.from("lesson_plans").select("id, week_label, class_id, subject, start_date, end_date, objectives, materials, methods, media, assessment, notes, created_at, updated_at").eq("teacher_id", teacherId).order("start_date"), "RPP"),
    rows(supabaseAdmin.from("annual_programs").select("id, title, class_id, subject, academic_year, items, notes, created_at, updated_at").eq("teacher_id", teacherId).order("updated_at", { ascending: false }), "program tahunan"),
    rows(supabaseAdmin.from("semester_programs").select("id, title, class_id, subject, academic_year, semester, items, notes, created_at, updated_at").eq("teacher_id", teacherId).order("updated_at", { ascending: false }), "program semester"),
    rows(supabaseAdmin.from("assignment_answer_keys").select("assignment_id, answer_key, created_at, updated_at").eq("teacher_id", teacherId), "kunci jawaban"),
    rows(supabaseAdmin.from("teacher_subjects").select("id, name, created_at").eq("teacher_id", teacherId).order("name"), "mata pelajaran guru"),
    one(supabaseAdmin.from("google_calendar_connections").select("google_email, token_expiry, created_at, updated_at").eq("user_id", teacherId).maybeSingle(), "status kalender Google"),
  ]);

  const materialIds = materials.map((m) => m.id as string);
  const materialReads = materialIds.length
    ? await rows(supabaseAdmin.from("material_reads").select("id, material_id, user_id, note, created_at, updated_at").in("material_id", materialIds).order("created_at"), "pembacaan materi")
    : [];
  const [announcements, events, bank, badges, activities] = await Promise.all([
    rows(supabaseAdmin.from("announcements").select("id, class_id, title, body, pinned, created_at, updated_at").eq("teacher_id", teacherId).order("created_at", { ascending: false }), "pengumuman"),
    rows(supabaseAdmin.from("events").select("id, class_id, title, description, location, start_at, end_at, quiz_link, game_link, google_event_id, created_at, updated_at").eq("teacher_id", teacherId).order("start_at"), "event kelas"),
    rows(supabaseAdmin.from("question_bank").select("id, subject, topic, question, stimulus, type, options, answer, difficulty, grade_level, image_url, indicator, points, time_limit_seconds, exam_category, quiz_link, game_link, halaqoh_kind, setoran_kind, min_pages, created_at, updated_at").eq("teacher_id", teacherId).order("created_at", { ascending: false }), "bank soal"),
    rows(supabaseAdmin.from("badges").select("id, code, name, description, icon, xp_requirement, created_at").order("name"), "daftar badge"),
    classIds.length ? rows(supabaseAdmin.from("class_activities").select("id, class_id, actor_id, target_user_id, action, metadata, created_at").in("class_id", classIds).order("created_at", { ascending: false }), "aktivitas kelas") : Promise.resolve([]),
  ]);
  const announcementIds = announcements.map((a) => a.id as string);
  const [announcementComments, announcementReactions, userBadges, xpTransactions, peerReactions] = await Promise.all([
    announcementIds.length ? rows(supabaseAdmin.from("announcement_comments").select("id, announcement_id, user_id, body, created_at").in("announcement_id", announcementIds).order("created_at"), "komentar pengumuman") : Promise.resolve([]),
    announcementIds.length ? rows(supabaseAdmin.from("announcement_reactions").select("id, announcement_id, user_id, emoji, created_at").in("announcement_id", announcementIds).order("created_at"), "reaksi pengumuman") : Promise.resolve([]),
    studentIds.length ? rows(supabaseAdmin.from("user_badges").select("id, user_id, earned_at, badges(name, description, icon, xp_requirement)").in("user_id", studentIds).order("earned_at", { ascending: false }), "badge siswa") : Promise.resolve([]),
    studentIds.length ? rows(supabaseAdmin.from("xp_transactions").select("id, user_id, source, source_id, xp_amount, coin_amount, note, created_at").in("user_id", studentIds).order("created_at", { ascending: false }), "transaksi XP") : Promise.resolve([]),
    studentIds.length ? rows(supabaseAdmin.from("peer_reactions").select("id, target_student_id, reactor_id, emoji, created_at").in("target_student_id", studentIds).order("created_at", { ascending: false }), "reaksi teman") : Promise.resolve([]),
  ]);

  const authorIds = Array.from(new Set([teacherId, ...studentIds]));
  const statuses = await rows(supabaseAdmin.from("statuses").select("id, author_id, content, mood, created_at, updated_at").in("author_id", authorIds).order("created_at", { ascending: false }), "status siswa");
  const statusIds = statuses.map((s) => s.id as string);
  const [statusComments, statusReactions] = await Promise.all([
    statusIds.length ? rows(supabaseAdmin.from("status_comments").select("id, status_id, author_id, content, created_at").in("status_id", statusIds).order("created_at"), "komentar status") : Promise.resolve([]),
    statusIds.length ? rows(supabaseAdmin.from("status_reactions").select("id, status_id, user_id, emoji, created_at").in("status_id", statusIds).order("created_at"), "reaksi status") : Promise.resolve([]),
  ]);

  const tabs: BackupTabs = {};
  tabs["Kelas"] = [["ID Kelas", "Nama Kelas", "Kode", "Deskripsi", "Mata Pelajaran", "Tahun Ajaran", "Dibuat", "Diperbarui"], ...classes.map((c) => [cell(c.id), cell(c.name), cell(c.code), cell(c.description), Array.isArray(c.subjects) ? c.subjects.join(", ") : cell(c.subject), cell(c.academic_year), cell(c.created_at), cell(c.updated_at)])];
  tabs["Pendaftaran Kelas"] = [["ID Pendaftaran", "Kelas", "NIS", "Nama Siswa", "Bergabung"], ...enrollments.map((e) => { const s = sMeta(e.student_id); return [cell(e.id), cName(e.class_id), s.nis, s.name, cell(e.joined_at)]; })];
  tabs["Siswa"] = [["ID Siswa", "NIS", "Nama Lengkap", "Username", "Kelas Terdaftar", "Kelas (Profil)", "Jenis Kelamin", "Tanggal Lahir", "Hobi", "Bio", "Motto", "Avatar", "Karakter", "XP", "Level", "Koin", "Diarsipkan", "Bergabung", "Diperbarui"], ...profiles.map((p) => { const priv = privateById.get(p.id) ?? {}; const primary = primaryClassByStudent.get(p.id); return [cell(p.id), cell(priv.school_id_number), cell(p.full_name), cell(p.username), primary ? cName(primary) : "", cell(p.class_name), cell(priv.gender), cell(priv.birthdate), cell(priv.hobby), cell(p.bio), cell(p.motto), cell(p.avatar_url), cell(p.character_key), cell(p.xp), cell(p.level), cell(p.coins), cell(p.archived_at), cell(p.created_at), cell(p.updated_at)]; })];
  tabs["Presensi"] = [["ID Presensi", "Tanggal", "Kelas", "NIS", "Nama Siswa", "Status", "Catatan", "Dicatat Oleh", "Dibuat", "Diperbarui"], ...attendance.map((a) => { const s = sMeta(a.student_id); return [cell(a.id), cell(a.date), cName(a.class_id), s.nis, s.name, cell(a.status), cell(a.note), userName(a.recorded_by), cell(a.created_at), cell(a.updated_at)]; })];

  const attAgg = new Map<string, { classId: string; studentId: string; counts: Record<AttStatus, number>; total: number; weighted: number }>();
  for (const a of attendance) {
    const key = `${a.class_id}::${a.student_id}`;
    const rec = attAgg.get(key) ?? { classId: a.class_id, studentId: a.student_id, counts: { hadir: 0, izin: 0, sakit: 0, alpa: 0 }, total: 0, weighted: 0 };
    const st = (a.status as AttStatus) in weights ? a.status as AttStatus : "alpa";
    rec.counts[st] += 1; rec.total += 1; rec.weighted += weights[st] ?? 0; attAgg.set(key, rec);
  }
  tabs["Nilai Kehadiran"] = [["Kelas", "NIS", "Nama Siswa", "Hadir", "Izin", "Sakit", "Alpa", "Total Pertemuan", "Nilai Kehadiran (0-100)"], ...Array.from(attAgg.values()).map((r) => ({ ...r, score: r.total ? Math.round(r.weighted / r.total) : 0 })).sort((a, b) => cName(a.classId).localeCompare(cName(b.classId)) || userName(a.studentId).localeCompare(userName(b.studentId))).map((r) => { const s = sMeta(r.studentId); return [cName(r.classId), s.nis, s.name, cell(r.counts.hadir), cell(r.counts.izin), cell(r.counts.sakit), cell(r.counts.alpa), cell(r.total), cell(r.score)]; })];
  tabs["Pengaturan Nilai"] = [["Pengaturan", "Hadir/Sumatif", "Izin/Adab", "Sakit/Absensi", "Alpa", "Diperbarui"], ["Bobot Presensi", cell(weights.hadir), cell(weights.izin), cell(weights.sakit), cell(weights.alpa), cell(settings?.updated_at)], ["Bobot Nilai Akhir", cell(gradeWeights?.sumatif ?? 60), cell(gradeWeights?.adab ?? 20), cell(gradeWeights?.absensi ?? 20), "", cell(gradeWeights?.updated_at)]];
  tabs["Mapel Guru"] = [["ID", "Mata Pelajaran", "Dibuat"], ...teacherSubjects.map((s) => [cell(s.id), cell(s.name), cell(s.created_at)])];
  tabs["Rekap Nilai"] = buildGradeRecap({ classes, enrollments, profiles, assignments, submissions, attendance, adab, materials, objectives, weights: gradeWeights ?? undefined, practiceAttempts });
  tabs["Latihan AI"] = [["ID Latihan", "Tanggal", "Kelas", "NIS", "Nama Siswa", "Mata Pelajaran", "Topik", "Tingkat", "Nilai Tambahan", "Jawaban Benar", "Petunjuk Digunakan", "Umpan Balik", "Konsep yang Perlu Diulang", "Rincian Jawaban"], ...practiceAttempts.map((a) => { const s = sMeta(a.student_id); return [cell(a.id), cell(a.created_at), cName(a.class_id), s.nis, s.name, cell(a.subject), cell(a.topic), cell(a.level), cell(a.score), `${a.correct_count}/${a.question_count}`, cell(a.hints_used), cell(a.feedback), Array.isArray(a.weak_concepts) ? a.weak_concepts.join(", ") : "", cell(a.answers)]; })];

  tabs["Tugas"] = [["ID Tugas", "Judul", "Kelas", "Siswa Khusus", "Mata Pelajaran", "Asesmen", "Jenis Ujian", "Halaqoh", "Format Jawaban", "Mode Interaktif", "Waktu per Soal (detik)", "Nilai Maks", "XP", "Koin", "Batas Waktu", "TP Utama", "Porsi Multi-TP", "Deskripsi", "Pilihan Lama", "Data Soal Lengkap", "Muroja Juz", "Muroja Surah", "Muroja Ayat", "Link Kuis", "Link Game", "URL Lampiran", "Nama Lampiran", "Tipe Lampiran", "Dibuat", "Diperbarui"], ...assignments.map((a) => [cell(a.id), cell(a.title), cName(a.class_id), a.assigned_student_id ? userName(a.assigned_student_id) : "Semua siswa", cell(a.subject), cell(a.assessment_kind), cell(a.exam_type), cell(a.halaqoh_kind), cell(a.answer_format), a.interactive_mode ? "Ya" : "Tidak", cell(a.question_time_limit), cell(a.max_score), cell(a.xp_reward), cell(a.coin_reward), cell(a.due_at), cell(a.objective_id), cell(a.objective_weights), cell(a.description), cell(a.options), cell(a.questions), cell(a.muroja_juz), cell(a.muroja_surah), cell(a.muroja_ayat), cell(a.quiz_link), cell(a.game_link), cell(a.attachment_url), cell(a.attachment_name), cell(a.attachment_type), cell(a.created_at), cell(a.updated_at)])];
  const questionRows: string[][] = [];
  for (const a of assignments) {
    const questions = Array.isArray(a.questions) ? a.questions : [];
    questions.forEach((q: any, index: number) => questionRows.push([cell(a.id), cell(a.title), cName(a.class_id), cell(a.subject), cell(index + 1), cell(q.type), cell(q.stimulus), cell(q.question ?? q.text), cell(q.options), cell(q.answer ?? q.correct_answer), cell(q.points), cell(q.time_limit_seconds ?? q.timeLimit), cell(q.difficulty), cell(q.indicator), cell(q.image_url ?? q.imageUrl), cell(q)]));
  }
  tabs["Soal Tugas"] = [["ID Tugas", "Judul Tugas", "Kelas", "Mata Pelajaran", "Nomor", "Tipe", "Stimulus", "Pertanyaan", "Pilihan", "Jawaban pada Data Soal", "Poin", "Waktu (detik)", "Kesulitan", "Indikator", "Gambar", "Data Soal Lengkap"], ...questionRows];
  tabs["Kunci Jawaban"] = [["ID Tugas", "Judul Tugas", "Kunci Jawaban", "Dibuat", "Diperbarui"], ...answerKeys.map((k) => [cell(k.assignment_id), cell(assignmentById.get(k.assignment_id)?.title), cell(k.answer_key), cell(k.created_at), cell(k.updated_at)])];
  tabs["Pengumpulan"] = [["ID Pengumpulan", "Tugas", "Kelas", "NIS", "Nama Siswa", "Status", "Nilai", "Rincian Nilai", "Jawaban", "URL File/Media", "Umpan Balik", "Media Umpan Balik", "Tipe Media Umpan Balik", "Dikumpulkan", "Dinilai", "Reward Diberikan", "Dibuat", "Diperbarui"], ...submissions.map((s) => { const m = sMeta(s.student_id); const a = assignmentById.get(s.assignment_id); return [cell(s.id), cell(a?.title ?? s.assignment_id), a ? cName(a.class_id) : "", m.nis, m.name, cell(s.status), cell(s.score), cell(s.score_breakdown), cell(s.content), cell(s.file_url), cell(s.feedback), cell(s.feedback_media_url), cell(s.feedback_media_type), cell(s.submitted_at), cell(s.graded_at), s.reward_granted ? "Ya" : "Tidak", cell(s.created_at), cell(s.updated_at)]; })];
  const submissionById = new Map(submissions.map((s) => [s.id as string, s]));
  tabs["Revisi Nilai"] = [["ID Revisi", "Tanggal", "Tugas", "Nama Siswa", "Status Sebelumnya", "Nilai Sebelumnya", "Umpan Balik Sebelumnya", "Media Umpan Balik", "Tipe Media", "Direvisi Oleh"], ...revisions.map((r) => { const s = submissionById.get(r.submission_id); const a = s ? assignmentById.get(s.assignment_id) : null; return [cell(r.id), cell(r.created_at), cell(a?.title), s ? userName(s.student_id) : "", cell(r.status), cell(r.score), cell(r.feedback), cell(r.feedback_media_url), cell(r.feedback_media_type), userName(r.revised_by)]; })];

  const submittedKeys = new Set(submissions.map((s) => `${s.assignment_id}::${s.student_id}`));
  const now = Date.now();
  const enrollmentsByClass = new Map<string, string[]>();
  for (const e of enrollments) { const list = enrollmentsByClass.get(e.class_id) ?? []; list.push(e.student_id); enrollmentsByClass.set(e.class_id, list); }
  const missedRows: string[][] = [];
  for (const a of assignments) {
    if (!a.due_at || new Date(a.due_at).getTime() > now) continue;
    const roster = a.assigned_student_id ? [a.assigned_student_id] : a.class_id ? enrollmentsByClass.get(a.class_id) ?? [] : [];
    for (const sid of roster) if (!submittedKeys.has(`${a.id}::${sid}`)) { const s = sMeta(sid); missedRows.push([cell(a.id), cell(a.title), cName(a.class_id), cell(a.subject), s.nis, s.name, cell(a.due_at)]); }
  }
  tabs["Tidak Mengerjakan"] = [["ID Tugas", "Tugas", "Kelas", "Mata Pelajaran", "NIS", "Nama Siswa", "Batas Waktu (Sudah Lewat)"], ...missedRows];
  tabs["Nilai Adab"] = [["ID", "NIS", "Nama Siswa", "Kelas", "Mata Pelajaran", "Nilai", "Dibuat", "Diperbarui"], ...adab.map((r) => { const s = sMeta(r.student_id); return [cell(r.id), s.nis, s.name, cName(r.class_id), cell(r.subject), cell(r.score), cell(r.created_at), cell(r.updated_at)]; })];
  tabs["Tujuan Pembelajaran"] = [["ID TP", "Kelas", "Mata Pelajaran", "Kode", "Deskripsi", "Urutan", "Dibuat", "Diperbarui"], ...objectives.map((o) => [cell(o.id), o.class_id ? cName(o.class_id) : "Semua kelas", cell(o.subject), cell(o.code), cell(o.description), cell(o.sort_order), cell(o.created_at), cell(o.updated_at)])];
  tabs["Mutaba'ah"] = [["ID", "Tanggal", "NIS", "Nama Siswa", "Kelas", "Sesi", "Jenis Setoran", "Surah", "Ayat Dari", "Ayat Sampai", "Juz", "Halaman", "Iqro Jilid", "Iqro Halaman", "Huruf Iqro", "Tajwid", "Kesalahan Tajwid", "Kelancaran", "Bantuan", "Fashohah", "Adab Aurat", "Adab Fokus", "Adab Etika", "Total", "Predikat", "Catatan", "Dibuat", "Diperbarui"], ...mutabaah.map((m) => { const s = sMeta(m.student_id); return [cell(m.id), cell(m.session_date), s.nis, s.name, cName(m.class_id), cell(m.session_type), cell(m.setoran_kind), cell(m.surah), cell(m.ayat_from), cell(m.ayat_to), cell(m.juz), cell(m.pages_count), cell(m.iqro_jilid), cell(m.iqro_page), Array.isArray(m.iqro_letters) ? m.iqro_letters.join(", ") : "", cell(m.tajwid_score), cell(m.tajwid_errors), cell(m.kelancaran_score), cell(m.kelancaran_helps), cell(m.fashohah_score), m.adab_aurat ? "Ya" : "Tidak", m.adab_focus ? "Ya" : "Tidak", m.adab_etika ? "Ya" : "Tidak", cell(m.total_score), cell(m.predikat), cell(m.notes), cell(m.created_at), cell(m.updated_at)]; })];
  tabs["Materi"] = [["ID Materi", "Judul", "Kelas", "Mata Pelajaran", "Deskripsi", "Isi Materi", "Link", "URL File", "Tipe Media", "URL Media", "URL Lampiran", "Nama Lampiran", "Tipe Lampiran", "Dibuat", "Diperbarui"], ...materials.map((m) => [cell(m.id), cell(m.title), cName(m.class_id), cell(m.subject), cell(m.description), cell(m.content), cell(m.link), cell(m.file_url), cell(m.media_type), cell(m.media_url), cell(m.attachment_url), cell(m.attachment_name), cell(m.attachment_type), cell(m.created_at), cell(m.updated_at)])];
  const materialById = new Map(materials.map((m) => [m.id as string, m]));
  tabs["Pembacaan Materi"] = [["ID", "Materi", "Kelas", "Nama Siswa", "Catatan", "Dibuat", "Diperbarui"], ...materialReads.map((r) => { const m = materialById.get(r.material_id); return [cell(r.id), cell(m?.title), cName(m?.class_id), userName(r.user_id), cell(r.note), cell(r.created_at), cell(r.updated_at)]; })];

  const programRows = (items: unknown) => Array.isArray(items) ? items.map((it: any) => [it.month, it.weeks, it.semester, it.material, it.hours ? `${it.hours} JP` : "", it.note].filter((v) => v !== undefined && v !== null && String(v).trim() !== "").join(" · ")).join("\n") : cell(items);
  tabs["Program Tahunan"] = [["ID", "Judul", "Kelas", "Mata Pelajaran", "Tahun Ajaran", "Rincian Materi", "Data Lengkap", "Catatan", "Dibuat", "Diperbarui"], ...annualPrograms.map((p) => [cell(p.id), cell(p.title), cName(p.class_id), cell(p.subject), cell(p.academic_year), programRows(p.items), cell(p.items), cell(p.notes), cell(p.created_at), cell(p.updated_at)])];
  tabs["Program Semester"] = [["ID", "Judul", "Kelas", "Mata Pelajaran", "Tahun Ajaran", "Semester", "Rincian Materi", "Data Lengkap", "Catatan", "Dibuat", "Diperbarui"], ...semesterPrograms.map((p) => [cell(p.id), cell(p.title), cName(p.class_id), cell(p.subject), cell(p.academic_year), cell(p.semester), programRows(p.items), cell(p.items), cell(p.notes), cell(p.created_at), cell(p.updated_at)])];
  tabs["Jurnal"] = [["ID", "Tanggal", "Kelas", "Nama Siswa", "Mata Pelajaran", "Topik/Kegiatan", "Catatan", "Dibuat", "Diperbarui"], ...journals.map((j) => [cell(j.id), cell(j.date), cName(j.class_id), j.student_id ? userName(j.student_id) : "Semua siswa", cell(j.subject), cell(j.topic), cell(j.notes), cell(j.created_at), cell(j.updated_at)])];
  tabs["RPP Pekanan"] = [["ID", "Pekan", "Kelas", "Mata Pelajaran", "Mulai", "Selesai", "Tujuan", "Materi Pokok", "Metode", "Media & Sumber", "Penilaian", "Catatan", "Dibuat", "Diperbarui"], ...lessonPlans.map((r) => [cell(r.id), cell(r.week_label), cName(r.class_id), cell(r.subject), cell(r.start_date), cell(r.end_date), cell(r.objectives), cell(r.materials), cell(r.methods), cell(r.media), cell(r.assessment), cell(r.notes), cell(r.created_at), cell(r.updated_at)])];

  const announcementById = new Map(announcements.map((a) => [a.id as string, a]));
  tabs["Pengumuman"] = [["ID", "Tanggal", "Kelas", "Judul", "Isi", "Disematkan", "Diperbarui"], ...announcements.map((a) => [cell(a.id), cell(a.created_at), cName(a.class_id), cell(a.title), cell(a.body), a.pinned ? "Ya" : "Tidak", cell(a.updated_at)])];
  tabs["Komentar Pengumuman"] = [["ID", "Tanggal", "Pengumuman", "Kelas", "Nama Pengguna", "Komentar"], ...announcementComments.map((r) => { const a = announcementById.get(r.announcement_id); return [cell(r.id), cell(r.created_at), cell(a?.title), cName(a?.class_id), userName(r.user_id), cell(r.body)]; })];
  tabs["Reaksi Pengumuman"] = [["ID", "Tanggal", "Pengumuman", "Kelas", "Nama Pengguna", "Reaksi"], ...announcementReactions.map((r) => { const a = announcementById.get(r.announcement_id); return [cell(r.id), cell(r.created_at), cell(a?.title), cName(a?.class_id), userName(r.user_id), cell(r.emoji)]; })];
  tabs["Event Kelas"] = [["ID", "Mulai", "Selesai", "Kelas", "Judul", "Deskripsi", "Lokasi", "Link Kuis", "Link Game", "ID Event Google", "Dibuat", "Diperbarui"], ...events.map((e) => [cell(e.id), cell(e.start_at), cell(e.end_at), cName(e.class_id), cell(e.title), cell(e.description), cell(e.location), cell(e.quiz_link), cell(e.game_link), cell(e.google_event_id), cell(e.created_at), cell(e.updated_at)])];
  tabs["Bank Soal"] = [["ID Soal", "Mata Pelajaran", "Topik", "Jenjang", "Kategori", "Tingkat", "Tipe", "Stimulus", "Pertanyaan", "Pilihan", "Jawaban", "Poin", "Waktu (detik)", "Indikator", "Gambar", "Link Kuis", "Link Game", "Halaqoh", "Setoran", "Minimal Halaman", "Dibuat", "Diperbarui"], ...bank.map((b) => [cell(b.id), cell(b.subject), cell(b.topic), cell(b.grade_level), cell(b.exam_category), cell(b.difficulty), cell(b.type), cell(b.stimulus), cell(b.question), cell(b.options), cell(b.answer), cell(b.points), cell(b.time_limit_seconds), cell(b.indicator), cell(b.image_url), cell(b.quiz_link), cell(b.game_link), cell(b.halaqoh_kind), cell(b.setoran_kind), cell(b.min_pages), cell(b.created_at), cell(b.updated_at)])];
  tabs["Daftar Badge"] = [["ID", "Kode", "Nama Badge", "Deskripsi", "Ikon", "Syarat XP", "Dibuat"], ...badges.map((b) => [cell(b.id), cell(b.code), cell(b.name), cell(b.description), cell(b.icon), cell(b.xp_requirement), cell(b.created_at)])];
  tabs["Badge Siswa"] = [["ID", "Diperoleh", "NIS", "Nama Siswa", "Nama Badge", "Deskripsi", "Ikon", "Syarat XP"], ...userBadges.map((ub) => { const s = sMeta(ub.user_id); const b = ub.badges ?? {}; return [cell(ub.id), cell(ub.earned_at), s.nis, s.name, cell(b.name), cell(b.description), cell(b.icon), cell(b.xp_requirement)]; })];
  tabs["Transaksi XP"] = [["ID", "Tanggal", "NIS", "Nama Siswa", "Sumber", "ID Sumber", "XP", "Koin", "Catatan"], ...xpTransactions.map((x) => { const s = sMeta(x.user_id); return [cell(x.id), cell(x.created_at), s.nis, s.name, cell(x.source), cell(x.source_id), cell(x.xp_amount), cell(x.coin_amount), cell(x.note)]; })];
  tabs["Permintaan Tugas"] = [["ID", "Dibuat", "NIS", "Nama Siswa", "Kelas", "Mata Pelajaran", "Judul", "Deskripsi", "Tenggat Diminta", "Status", "Catatan Guru", "ID Tugas Terkait", "Ditanggapi", "Diperbarui"], ...taskRequests.map((r) => { const s = sMeta(r.student_id); return [cell(r.id), cell(r.created_at), s.nis, s.name, cName(r.class_id), cell(r.subject), cell(r.title), cell(r.description), cell(r.desired_due_at), cell(r.status), cell(r.teacher_note), cell(r.assignment_id), cell(r.responded_at), cell(r.updated_at)]; })];
  tabs["Aktivitas Kelas"] = [["ID", "Tanggal", "Kelas", "Aksi", "Pelaku", "Siswa Terkait", "Rincian"], ...activities.map((a) => [cell(a.id), cell(a.created_at), cName(a.class_id), cell(a.action), userName(a.actor_id), a.target_user_id ? userName(a.target_user_id) : "", cell(a.metadata)])];

  const statusById = new Map(statuses.map((s) => [s.id as string, s]));
  tabs["Status Siswa"] = [["ID", "Tanggal", "Penulis", "Suasana", "Isi", "Diperbarui"], ...statuses.map((s) => [cell(s.id), cell(s.created_at), userName(s.author_id), cell(s.mood), cell(s.content), cell(s.updated_at)])];
  tabs["Komentar Status"] = [["ID", "Tanggal", "Penulis Status", "Isi Status", "Pemberi Komentar", "Komentar"], ...statusComments.map((r) => { const s = statusById.get(r.status_id); return [cell(r.id), cell(r.created_at), userName(s?.author_id), cell(s?.content), userName(r.author_id), cell(r.content)]; })];
  tabs["Reaksi Status"] = [["ID", "Tanggal", "Penulis Status", "Isi Status", "Pemberi Reaksi", "Reaksi"], ...statusReactions.map((r) => { const s = statusById.get(r.status_id); return [cell(r.id), cell(r.created_at), userName(s?.author_id), cell(s?.content), userName(r.user_id), cell(r.emoji)]; })];
  tabs["Reaksi Teman"] = [["ID", "Tanggal", "Pemberi Reaksi", "Siswa Penerima", "Reaksi"], ...peerReactions.map((r) => [cell(r.id), cell(r.created_at), userName(r.reactor_id), userName(r.target_student_id), cell(r.emoji)])];
  tabs["Kalender Google"] = [["Email Google", "Masa Berlaku Token", "Terhubung Sejak", "Diperbarui", "Catatan Keamanan"], ...(calendar ? [[cell(calendar.google_email), cell(calendar.token_expiry), cell(calendar.created_at), cell(calendar.updated_at), "Token akses dan token pemulihan tidak disalin ke spreadsheet."]] : [])];

  const syncedAt = new Date().toISOString();
  tabs["Ringkasan Backup"] = [["Nama Tab", "Jumlah Baris Data", "Waktu Backup"], ...BACKUP_TAB_TITLES.filter((title) => title !== "Ringkasan Backup").map((title) => {
    if (!tabs[title]) throw new Error(`Tab backup ${title} belum disiapkan.`);
    return [title, cell(Math.max(0, tabs[title].length - 1)), syncedAt];
  })];
  return tabs;
}

function clamp(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export type SyncResult = { url: string; spreadsheetId: string; tables: number; syncedAt: string };

export async function runSheetSyncForTeacher(teacherId: string): Promise<SyncResult> {
  const headers = gatewayHeaders();
  const [{ data: profile }, email] = await Promise.all([
    supabaseAdmin.from("profiles").select("full_name").eq("id", teacherId).maybeSingle(),
    getTeacherEmail(teacherId),
  ]);
  const teacherName = (profile as { full_name?: string } | null)?.full_name || "Guru";
  const title = `Data Pelajaranku · ${teacherName}${email ? ` (${email})` : ""}`;
  const { data: state, error: stateError } = await supabaseAdmin.from("teacher_sheet_sync").select("spreadsheet_id, spreadsheet_url").eq("teacher_id", teacherId).maybeSingle();
  if (stateError) throw stateError;
  let spreadsheetId = (state as { spreadsheet_id?: string } | null)?.spreadsheet_id ?? null;
  let spreadsheetUrl = (state as { spreadsheet_url?: string } | null)?.spreadsheet_url ?? null;

  if (spreadsheetId) {
    const tabs = await getExistingTabs(spreadsheetId, headers);
    if (tabs === null) throw new Error("Spreadsheet backup yang tersimpan tidak ditemukan. Periksa akses Google; file baru tidak dibuat.");
    await addMissingTabs(spreadsheetId, tabs, headers);
  }
  if (!spreadsheetId) {
    const created = await createSpreadsheet(title, headers);
    spreadsheetId = created.spreadsheetId;
    spreadsheetUrl = created.spreadsheetUrl;
  }

  try {
    const tabs = await buildTeacherTabs(teacherId);
    await writeAllTabs(spreadsheetId, tabs, headers);
    const syncedAt = new Date().toISOString();
    await supabaseAdmin.from("teacher_sheet_sync").upsert({ teacher_id: teacherId, spreadsheet_id: spreadsheetId, spreadsheet_url: spreadsheetUrl, last_synced_at: syncedAt, last_status: "ok" });
    return { url: spreadsheetUrl ?? "", spreadsheetId, tables: BACKUP_TAB_TITLES.length, syncedAt };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync gagal";
    await supabaseAdmin.from("teacher_sheet_sync").upsert({ teacher_id: teacherId, spreadsheet_id: spreadsheetId, spreadsheet_url: spreadsheetUrl, last_synced_at: new Date().toISOString(), last_status: `error: ${message.slice(0, 200)}` });
    throw e;
  }
}

export async function runAllTeacherSheetSync(): Promise<{ teachers: number; ok: number; failed: number }> {
  const { data: roles, error } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "guru");
  if (error) throw error;
  const teacherIds = Array.from(new Set((roles ?? []).map((r) => r.user_id as string)));
  let ok = 0;
  let failed = 0;
  for (const id of teacherIds) {
    try { await runSheetSyncForTeacher(id); ok += 1; }
    catch (e) { failed += 1; console.error(`[sheets-sync] teacher ${id} failed:`, e instanceof Error ? e.message : e); }
  }
  return { teachers: teacherIds.length, ok, failed };
}
