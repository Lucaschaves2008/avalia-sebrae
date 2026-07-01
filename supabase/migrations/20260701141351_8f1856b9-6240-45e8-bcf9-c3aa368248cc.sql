
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recompute_final_opinion_status() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_final_opinion_for_process() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_final_opinion_items() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.finalize_process_on_opinion_finalize() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) TO authenticated, service_role;
