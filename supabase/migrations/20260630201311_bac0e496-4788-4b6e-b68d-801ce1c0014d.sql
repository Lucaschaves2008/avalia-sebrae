
-- Clean existing judgments
DELETE FROM public.judgments;

-- evaluation_processes
CREATE TABLE public.evaluation_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  scope text NOT NULL CHECK (scope IN ('NACIONAL','REGIONAL','AMBOS')),
  status text NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO','INATIVO','FINALIZADO')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_processes TO authenticated;
GRANT ALL ON public.evaluation_processes TO service_role;
ALTER TABLE public.evaluation_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view processes"
  ON public.evaluation_processes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert processes"
  ON public.evaluation_processes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update processes"
  ON public.evaluation_processes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete processes"
  ON public.evaluation_processes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER evaluation_processes_set_updated_at
  BEFORE UPDATE ON public.evaluation_processes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- evaluation_process_courses (N:N)
CREATE TABLE public.evaluation_process_courses (
  process_id uuid NOT NULL REFERENCES public.evaluation_processes(id) ON DELETE RESTRICT,
  course_id text NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (process_id, course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_process_courses TO authenticated;
GRANT ALL ON public.evaluation_process_courses TO service_role;
ALTER TABLE public.evaluation_process_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view process courses"
  ON public.evaluation_process_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage process courses insert"
  ON public.evaluation_process_courses FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage process courses delete"
  ON public.evaluation_process_courses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- judgments: add process_id, change unique
ALTER TABLE public.judgments
  ADD COLUMN process_id uuid NOT NULL REFERENCES public.evaluation_processes(id) ON DELETE RESTRICT;

-- Drop old unique on (course_id, user_id) if exists
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.judgments'::regclass AND contype='u';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.judgments DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE public.judgments
  ADD CONSTRAINT judgments_process_course_user_unique UNIQUE (process_id, course_id, user_id);
