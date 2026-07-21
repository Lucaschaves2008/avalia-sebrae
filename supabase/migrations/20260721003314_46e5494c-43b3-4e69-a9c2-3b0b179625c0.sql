
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
  v_self_signup boolean;
BEGIN
  v_self_signup := COALESCE((NEW.raw_user_meta_data->>'self_signup')::boolean, false);

  INSERT INTO public.profiles (id, name, email, phone, unity, region, state, status, is_first_access)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'unity', 'Sebrae'),
    COALESCE(NEW.raw_user_meta_data->>'region', 'Sudeste'),
    NEW.raw_user_meta_data->>'state',
    'Ativo',
    NOT v_self_signup
  );

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    v_role := 'admin';
  ELSE
    v_role := 'gestor';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END; $function$;
