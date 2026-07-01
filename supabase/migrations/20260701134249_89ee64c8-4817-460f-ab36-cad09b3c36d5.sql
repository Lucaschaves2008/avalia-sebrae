CREATE OR REPLACE FUNCTION public.finalize_process_on_opinion_finalize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'FINALIZADO' AND (OLD.status IS DISTINCT FROM 'FINALIZADO') THEN
    UPDATE public.evaluation_processes
      SET status = 'FINALIZADO'
      WHERE id = NEW.process_id AND status <> 'FINALIZADO';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_finalize_process_on_opinion ON public.final_opinions;
CREATE TRIGGER trg_finalize_process_on_opinion
AFTER UPDATE ON public.final_opinions
FOR EACH ROW EXECUTE FUNCTION public.finalize_process_on_opinion_finalize();