
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.recompute_final_opinion_status() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.finalize_process_on_opinion_finalize() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.sync_final_opinion_items() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.create_final_opinion_for_process() FROM PUBLIC, authenticated, anon;
