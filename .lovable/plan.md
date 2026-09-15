# Plan: Detailed Quiz Scoring and Questions

## Goal
Improve quiz authoring and results so teachers can configure each question precisely, while students and teachers receive a clear final score and performance breakdown.

## Changes
- Extend each quiz question with optional stimulus text, image, point value, time limit, and performance category/indicator.
- Update Bank Soal and assignment quiz editors/import-transfer flows to preserve and edit those fields.
- Update interactive quiz play to display stimulus separately, show the question image, use each question’s configured time, and calculate progress without changing legacy quizzes.
- Update automatic and manual grading to use per-question points, while retaining the assignment maximum as the normalized final-score scale.
- Add final-result breakdowns for students and grading/review breakdowns for teachers by category or indicator.
- Keep existing question data valid by applying sensible defaults when new fields are absent.

## Technical details
- Store the new fields within the existing question JSON payload to avoid a disruptive question-table migration.
- Revise the grading database function so objective and manually reviewed answers share one weighted scoring model.
- Reuse existing media storage and signed-access patterns for question images.
- Validate legacy and interactive quiz flows on phone and desktop, then check compilation and runtime diagnostics.
