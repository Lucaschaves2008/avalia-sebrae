ALTER TABLE public.judgments ALTER COLUMN priority DROP NOT NULL;
ALTER TABLE public.judgments DROP CONSTRAINT IF EXISTS judgments_priority_check;
ALTER TABLE public.judgments ADD CONSTRAINT judgments_priority_check CHECK (priority IS NULL OR priority IN ('Alta','Média','Baixa'));