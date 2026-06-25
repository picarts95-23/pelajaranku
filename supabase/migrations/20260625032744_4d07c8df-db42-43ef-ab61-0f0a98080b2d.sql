-- E&F: Halaqoh Qur'an daily score accumulation from Mutaba'ah + graded Halaqoh tasks

-- 1. Tag assignments with a Halaqoh session kind so graded Halaqoh tasks
--    flow into the Mutaba'ah accumulation (null = not a Halaqoh task).
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS halaqoh_kind text;

-- 2. Per-student accumulated Halaqoh daily score for a class.
--    Sources: manual tahfidz_mutabaah records + graded assignments tagged
--    with a halaqoh_kind. Weights: Ziyadah 30%, Muroja'ah 40%, Tilawah 30%.
--    Weights are normalised across the components that actually have data so a
--    not-yet-recorded component does not deflate the daily score.
CREATE OR REPLACE FUNCTION public.halaqoh_daily_scores(_class_id uuid)
RETURNS TABLE(student_id uuid, ziyadah numeric, murojaah numeric, tilawah numeric, daily numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'guru') THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH src AS (
    -- Manual Mutaba'ah records
    SELECT m.student_id AS sid,
           CASE
             WHEN lower(coalesce(m.session_type, '')) LIKE 'ziyadah%' THEN 'ziyadah'
             WHEN lower(coalesce(m.session_type, '')) LIKE 'muroj%'
               OR lower(coalesce(m.session_type, '')) LIKE 'muraj%' THEN 'murojaah'
             WHEN lower(coalesce(m.session_type, '')) LIKE 'tilawah%' THEN 'tilawah'
             ELSE 'ziyadah'
           END AS kind,
           m.total_score::numeric AS score
    FROM public.tahfidz_mutabaah m
    WHERE m.class_id = _class_id
    UNION ALL
    -- Graded Halaqoh assignment submissions
    SELECT s.student_id AS sid,
           lower(a.halaqoh_kind) AS kind,
           CASE WHEN a.max_score > 0 THEN (s.score::numeric / a.max_score) * 100 ELSE 0 END AS score
    FROM public.submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    WHERE a.class_id = _class_id
      AND lower(coalesce(a.halaqoh_kind, '')) IN ('ziyadah', 'murojaah', 'tilawah')
      AND s.status = 'graded'
      AND s.score IS NOT NULL
  ),
  agg AS (
    SELECT src.sid,
           avg(src.score) FILTER (WHERE src.kind = 'ziyadah')  AS z,
           avg(src.score) FILTER (WHERE src.kind = 'murojaah') AS m,
           avg(src.score) FILTER (WHERE src.kind = 'tilawah')  AS t
    FROM src
    GROUP BY src.sid
  )
  SELECT agg.sid,
         round(coalesce(agg.z, 0))::numeric,
         round(coalesce(agg.m, 0))::numeric,
         round(coalesce(agg.t, 0))::numeric,
         round(
           CASE
             WHEN (CASE WHEN agg.z IS NOT NULL THEN 0.30 ELSE 0 END
                 + CASE WHEN agg.m IS NOT NULL THEN 0.40 ELSE 0 END
                 + CASE WHEN agg.t IS NOT NULL THEN 0.30 ELSE 0 END) = 0 THEN 0
             ELSE (coalesce(agg.z, 0) * (CASE WHEN agg.z IS NOT NULL THEN 0.30 ELSE 0 END)
                 + coalesce(agg.m, 0) * (CASE WHEN agg.m IS NOT NULL THEN 0.40 ELSE 0 END)
                 + coalesce(agg.t, 0) * (CASE WHEN agg.t IS NOT NULL THEN 0.30 ELSE 0 END))
                 / (CASE WHEN agg.z IS NOT NULL THEN 0.30 ELSE 0 END
                  + CASE WHEN agg.m IS NOT NULL THEN 0.40 ELSE 0 END
                  + CASE WHEN agg.t IS NOT NULL THEN 0.30 ELSE 0 END)
           END
         )::numeric
  FROM agg;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.halaqoh_daily_scores(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.halaqoh_daily_scores(uuid) TO authenticated;