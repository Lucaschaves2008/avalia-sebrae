CREATE OR REPLACE FUNCTION public.recompute_final_opinion_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_opinion_id uuid;
  v_total int;
  v_decided int;
  v_current_status text;
  v_new_status text;
BEGIN
  v_opinion_id := COALESCE(NEW.opinion_id, OLD.opinion_id);

  SELECT status INTO v_current_status FROM public.final_opinions WHERE id = v_opinion_id;

  -- Do not touch a manually finalized opinion. Finalization is a manual action.
  IF v_current_status = 'FINALIZADO' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*), COUNT(decision)
    INTO v_total, v_decided
    FROM public.final_opinion_items WHERE opinion_id = v_opinion_id;

  IF v_decided = 0 THEN
    v_new_status := 'NAO_INICIADO';
  ELSE
    -- Any decision progress keeps the opinion open (EM_ANDAMENTO) even when all items are decided.
    -- The Gerência Nacional finalizes manually via the UI button.
    v_new_status := 'EM_ANDAMENTO';
  END IF;

  UPDATE public.final_opinions
    SET status = v_new_status,
        finalized_at = NULL
    WHERE id = v_opinion_id;

  RETURN COALESCE(NEW, OLD);
END; $function$;