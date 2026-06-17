
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS fgv_inclusion_tools TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS fgv_synthesis TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS fgv_attention_points TEXT DEFAULT '';
