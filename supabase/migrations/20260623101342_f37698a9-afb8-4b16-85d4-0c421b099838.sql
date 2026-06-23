-- Allow teachers to see which of their materials each student has read.
-- Reading progress lives in material_reads; previously only the student
-- (owner) could read their own rows. Teachers need to see completion per
-- material they own to track reading progress.
CREATE POLICY "Teachers view reads of their materials"
ON public.material_reads
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.materials m
    WHERE m.id = material_reads.material_id
      AND m.teacher_id = auth.uid()
  )
);