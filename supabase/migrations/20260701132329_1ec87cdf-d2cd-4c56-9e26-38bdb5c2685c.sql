
REVOKE EXECUTE ON FUNCTION public.create_final_opinion_for_process() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_final_opinion_items() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_final_opinion_status() FROM PUBLIC, anon, authenticated;
