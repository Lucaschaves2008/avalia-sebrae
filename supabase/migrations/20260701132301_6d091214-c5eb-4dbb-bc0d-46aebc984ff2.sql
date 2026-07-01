
-- ============ Tables ============
CREATE TABLE public.final_opinions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL UNIQUE REFERENCES public.evaluation_processes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'NAO_INICIADO'
    CHECK (status IN ('NAO_INICIADO','EM_ANDAMENTO','FINALIZADO')),
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.final_opinions TO authenticated;
GRANT ALL ON public.final_opinions TO service_role;
ALTER TABLE public.final_opinions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view opinions"
  ON public.final_opinions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage opinions"
  ON public.final_opinions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER final_opinions_set_updated_at
BEFORE UPDATE ON public.final_opinions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.final_opinion_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opinion_id uuid NOT NULL REFERENCES public.final_opinions(id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  decision text CHECK (decision IN ('MANTER','ATUALIZAR','INATIVAR')),
  observation text NOT NULL DEFAULT '',
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opinion_id, course_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.final_opinion_items TO authenticated;
GRANT ALL ON public.final_opinion_items TO service_role;
ALTER TABLE public.final_opinion_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view opinion items"
  ON public.final_opinion_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage opinion items"
  ON public.final_opinion_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER final_opinion_items_set_updated_at
BEFORE UPDATE ON public.final_opinion_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============ Auto-create opinion + items when process is created ============
CREATE OR REPLACE FUNCTION public.create_final_opinion_for_process()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opinion_id uuid;
BEGIN
  INSERT INTO public.final_opinions (process_id) VALUES (NEW.id)
  RETURNING id INTO v_opinion_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER evaluation_processes_create_opinion
AFTER INSERT ON public.evaluation_processes
FOR EACH ROW EXECUTE FUNCTION public.create_final_opinion_for_process();


-- Sync items when a course is linked to / unlinked from a process
CREATE OR REPLACE FUNCTION public.sync_final_opinion_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opinion_id uuid;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    SELECT id INTO v_opinion_id FROM public.final_opinions WHERE process_id = NEW.process_id;
    IF v_opinion_id IS NOT NULL THEN
      INSERT INTO public.final_opinion_items (opinion_id, course_id)
      VALUES (v_opinion_id, NEW.course_id)
      ON CONFLICT (opinion_id, course_id) DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    SELECT id INTO v_opinion_id FROM public.final_opinions WHERE process_id = OLD.process_id;
    IF v_opinion_id IS NOT NULL THEN
      DELETE FROM public.final_opinion_items
        WHERE opinion_id = v_opinion_id AND course_id = OLD.course_id
          AND decision IS NULL;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER evaluation_process_courses_sync_items
AFTER INSERT OR DELETE ON public.evaluation_process_courses
FOR EACH ROW EXECUTE FUNCTION public.sync_final_opinion_items();


-- ============ Recompute opinion status when items change ============
CREATE OR REPLACE FUNCTION public.recompute_final_opinion_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opinion_id uuid;
  v_total int;
  v_decided int;
  v_new_status text;
  v_process_id uuid;
BEGIN
  v_opinion_id := COALESCE(NEW.opinion_id, OLD.opinion_id);

  SELECT COUNT(*), COUNT(decision)
    INTO v_total, v_decided
    FROM public.final_opinion_items WHERE opinion_id = v_opinion_id;

  IF v_total = 0 THEN
    v_new_status := 'NAO_INICIADO';
  ELSIF v_decided = 0 THEN
    v_new_status := 'NAO_INICIADO';
  ELSIF v_decided < v_total THEN
    v_new_status := 'EM_ANDAMENTO';
  ELSE
    v_new_status := 'FINALIZADO';
  END IF;

  UPDATE public.final_opinions
    SET status = v_new_status,
        finalized_at = CASE WHEN v_new_status = 'FINALIZADO' THEN now() ELSE NULL END
    WHERE id = v_opinion_id
    RETURNING process_id INTO v_process_id;

  -- When opinion is finalized, also finalize the parent process
  IF v_new_status = 'FINALIZADO' AND v_process_id IS NOT NULL THEN
    UPDATE public.evaluation_processes
      SET status = 'FINALIZADO' WHERE id = v_process_id AND status <> 'FINALIZADO';
  END IF;

  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER final_opinion_items_recompute
AFTER INSERT OR UPDATE OF decision OR DELETE ON public.final_opinion_items
FOR EACH ROW EXECUTE FUNCTION public.recompute_final_opinion_status();


-- ============ Backfill: create opinions + items for existing processes ============
INSERT INTO public.final_opinions (process_id)
SELECT p.id FROM public.evaluation_processes p
LEFT JOIN public.final_opinions o ON o.process_id = p.id
WHERE o.id IS NULL;

INSERT INTO public.final_opinion_items (opinion_id, course_id)
SELECT o.id, epc.course_id
FROM public.final_opinions o
JOIN public.evaluation_process_courses epc ON epc.process_id = o.process_id
LEFT JOIN public.final_opinion_items i
  ON i.opinion_id = o.id AND i.course_id = epc.course_id
WHERE i.id IS NULL;
