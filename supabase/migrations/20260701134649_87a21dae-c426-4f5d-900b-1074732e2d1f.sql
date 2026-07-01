ALTER TABLE public.final_opinion_items
  ADD COLUMN IF NOT EXISTS priority text
  CHECK (priority IN ('ALTA','MEDIA','BAIXA'));