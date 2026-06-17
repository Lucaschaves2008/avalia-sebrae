
-- Roles enum + table for admin/gestor distinction
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor');

-- 1. Profiles
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  unity TEXT NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('Norte','Sul','Nordeste','Centro-Oeste','Sudeste')),
  is_first_access BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Profiles policies
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins manage profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- user_roles policies
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 2. Courses
CREATE TABLE public.courses (
  id TEXT PRIMARY KEY,
  solution_name TEXT NOT NULL,
  access_link TEXT,
  target_audience TEXT,
  instrument TEXT,
  modality TEXT,
  activation_date DATE,
  age_months INT,
  current_year_attendance INT DEFAULT 0,
  ids_score NUMERIC(5,2),
  bcg_classification TEXT,
  has_moa BOOLEAN DEFAULT false,
  has_class_plans BOOLEAN DEFAULT false,
  has_consultant_manual BOOLEAN DEFAULT false,
  has_multiplicator_manual BOOLEAN DEFAULT false,
  has_manager_manual BOOLEAN DEFAULT false,
  has_teacher_guide BOOLEAN DEFAULT false,
  has_student_manual BOOLEAN DEFAULT false,
  has_slides BOOLEAN DEFAULT false,
  has_technical_sheet BOOLEAN DEFAULT false,
  has_marketing_kit BOOLEAN DEFAULT false,
  fgv_bncc TEXT CHECK (fgv_bncc IN ('NA','PA','NAP','SA')),
  fgv_context TEXT CHECK (fgv_context IN ('NA','PA','NAP','SA')),
  fgv_conceptual TEXT CHECK (fgv_conceptual IN ('NA','PA','NAP','SA')),
  fgv_visual TEXT CHECK (fgv_visual IN ('NA','PA','NAP','SA')),
  fgv_learning_eval TEXT CHECK (fgv_learning_eval IN ('NA','PA','NAP','SA')),
  fgv_socioemotional TEXT CHECK (fgv_socioemotional IN ('NA','PA','NAP','SA')),
  fgv_entrecomp TEXT CHECK (fgv_entrecomp IN ('NA','PA','NAP','SA')),
  fgv_life_project TEXT CHECK (fgv_life_project IN ('NA','PA','NAP','SA')),
  fgv_transversal TEXT CHECK (fgv_transversal IN ('NA','PA','NAP','SA')),
  fgv_community TEXT CHECK (fgv_community IN ('NA','PA','NAP','SA')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Courses readable by authenticated" ON public.courses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage courses" ON public.courses
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3. Judgments
CREATE TABLE public.judgments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id TEXT REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  region TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('MANTIDO','ATUALIZADO','INATIVAÇÃO')),
  updates_required TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('Alta','Média','Baixa')),
  notes TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(course_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.judgments TO authenticated;
GRANT ALL ON public.judgments TO service_role;
ALTER TABLE public.judgments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Judgments readable by authenticated" ON public.judgments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own judgments" ON public.judgments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own judgments" ON public.judgments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own judgments" ON public.judgments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage judgments" ON public.judgments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Auto-update updated_at on judgments
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE TRIGGER judgments_set_updated_at BEFORE UPDATE ON public.judgments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + default 'gestor' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone, unity, region)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'unity', 'Sebrae'),
    COALESCE(NEW.raw_user_meta_data->>'region', 'Sudeste')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'gestor');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
