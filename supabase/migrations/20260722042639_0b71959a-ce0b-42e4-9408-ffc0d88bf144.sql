CREATE OR REPLACE FUNCTION public.halaqoh_daily_scores(_class_id uuid)
 RETURNS TABLE(student_id uuid, ziyadah numeric, murojaah numeric, tilawah numeric, daily numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'guru') THEN
    RETURN;
  END IF;
  IF NOT public.is_class_owner(_class_id, auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH src AS (
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
$function$;