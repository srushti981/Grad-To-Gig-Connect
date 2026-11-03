-- ===== ROLES =====
create type public.app_role as enum ('student', 'recruiter', 'admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users can view own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- ===== PROFILES =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  roll_no text,
  branch text,
  cgpa numeric(4,2),
  graduation_year int,
  resume_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Own profile plus recruiters and admins" on public.profiles for select to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'recruiter') or public.has_role(auth.uid(), 'admin'));
create policy "Users create own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users update own profile, admins any" on public.profiles for update to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));

-- ===== COMPANIES =====
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  industry text,
  about text,
  logo_emoji text default '🏢',
  verified boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select on public.companies to anon, authenticated;
grant insert, update, delete on public.companies to authenticated;
grant all on public.companies to service_role;
alter table public.companies enable row level security;
create policy "Companies are publicly readable" on public.companies for select using (true);
create policy "Recruiters and admins can create companies" on public.companies for insert to authenticated
  with check (public.has_role(auth.uid(), 'recruiter') or public.has_role(auth.uid(), 'admin'));
create policy "Owners and admins can update companies" on public.companies for update to authenticated
  using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));

alter table public.profiles add column company_id uuid references public.companies(id) on delete set null;

-- ===== JOBS =====
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  posted_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  job_type text not null default 'full-time',
  location text,
  work_mode text not null default 'onsite',
  ctc_min numeric,
  ctc_max numeric,
  stipend numeric,
  eligible_branches text[] not null default '{}',
  min_cgpa numeric(4,2) default 0,
  min_grad_year int,
  max_grad_year int,
  openings int not null default 1,
  deadline timestamptz,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
grant select on public.jobs to anon, authenticated;
grant insert, update, delete on public.jobs to authenticated;
grant all on public.jobs to service_role;
alter table public.jobs enable row level security;
create policy "Jobs are publicly readable" on public.jobs for select using (true);
create policy "Recruiters and admins can post jobs" on public.jobs for insert to authenticated
  with check ((public.has_role(auth.uid(), 'recruiter') or public.has_role(auth.uid(), 'admin')) and posted_by = auth.uid());
create policy "Job owners and admins manage jobs" on public.jobs for update to authenticated
  using (posted_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Job owners and admins delete jobs" on public.jobs for delete to authenticated
  using (posted_by = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- ===== APPLICATIONS =====
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'applied',
  cover_letter text,
  final_package numeric,
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, student_id)
);
grant select, insert, update, delete on public.applications to authenticated;
grant all on public.applications to service_role;
alter table public.applications enable row level security;
create policy "Students see own, recruiters see applicants, admins all" on public.applications for select to authenticated
  using (
    student_id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.jobs j
      where j.id = job_id and (j.posted_by = auth.uid() or public.has_role(auth.uid(), 'recruiter'))
    )
  );
create policy "Eligible students apply to open jobs" on public.applications for insert to authenticated
  with check (
    auth.uid() = student_id
    and public.has_role(auth.uid(), 'student')
    and exists (
      select 1 from public.jobs j
      join public.profiles p on p.id = auth.uid()
      where j.id = job_id
        and j.status = 'open'
        and (j.deadline is null or j.deadline > now())
        and (array_length(j.eligible_branches, 1) is null or p.branch = any(j.eligible_branches))
        and (j.min_cgpa is null or (p.cgpa is not null and p.cgpa >= j.min_cgpa))
        and (j.min_grad_year is null or p.graduation_year >= j.min_grad_year)
        and (j.max_grad_year is null or p.graduation_year <= j.max_grad_year)
    )
  );
create policy "Recruiters and admins update applications" on public.applications for update to authenticated
  using (
    exists (select 1 from public.jobs j where j.id = job_id and j.posted_by = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );
create policy "Students withdraw own applications" on public.applications for delete to authenticated
  using (student_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- ===== INTERVIEWS =====
create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  round text not null default 'Technical Round 1',
  scheduled_at timestamptz not null,
  mode text not null default 'online',
  location text,
  status text not null default 'scheduled',
  feedback text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.interviews to authenticated;
grant all on public.interviews to service_role;
alter table public.interviews enable row level security;
create policy "Participants read interviews" on public.interviews for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or created_by = auth.uid()
    or exists (
      select 1 from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.id = application_id
        and (a.student_id = auth.uid() or j.posted_by = auth.uid())
    )
  );
create policy "Job owner or admin schedules interviews" on public.interviews for insert to authenticated
  with check (
    exists (select 1 from public.applications a join public.jobs j on j.id = a.job_id where a.id = application_id and j.posted_by = auth.uid())
    or public.has_role(auth.uid(), 'admin')
  );
create policy "Job owner or admin updates interviews" on public.interviews for update to authenticated
  using (
    exists (select 1 from public.applications a join public.jobs j on j.id = a.job_id where a.id = application_id and j.posted_by = auth.uid())
    or public.has_role(auth.uid(), 'admin')
    or exists (select 1 from public.applications a where a.id = application_id and a.student_id = auth.uid())
  );

-- ===== NOTIFICATIONS =====
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "Own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "System inserts notifications" on public.notifications for insert to authenticated with check (user_id = auth.uid());
create policy "Mark own notifications read" on public.notifications for update to authenticated using (user_id = auth.uid());

-- ===== UPDATED_AT TRIGGER =====
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;
create trigger trg_applications_updated before update on public.applications
  for each row execute function public.touch_updated_at();
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ===== SIGNUP TRIGGER =====
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_role text := lower(coalesce(new.raw_user_meta_data->>'role', 'student'));
begin
  if chosen_role not in ('student', 'recruiter') then
    chosen_role := 'student';
  end if;
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  insert into public.user_roles (user_id, role) values (new.id, chosen_role::app_role);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ===== NOTIFICATION TRIGGERS =====
create or replace function public.notify_application_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications (user_id, title, body)
    values (
      new.student_id,
      'Application update',
      (select title from public.jobs where id = new.job_id) || ' — your status is now "' || new.status || '".'
    );
  end if;
  return new;
end;
$$;
create trigger trg_application_status after update on public.applications
  for each row execute function public.notify_application_status();

create or replace function public.notify_interview_scheduled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body)
  select a.student_id,
    'Interview scheduled',
    new.round || ' on ' || to_char(new.scheduled_at, 'DD Mon YYYY, HH12:MI AM') ||
      case when new.mode = 'online' then ' (online)' else ' at ' || coalesce(new.location, 'venue TBA') end
  from public.applications a where a.id = new.application_id;
  return new;
end;
$$;
create trigger trg_interview_scheduled after insert on public.interviews
  for each row execute function public.notify_interview_scheduled();

-- ===== DEMO DATA =====
insert into public.companies (name, website, industry, about, logo_emoji, verified) values
  ('Nexovia Labs', 'https://nexovia.example.com', 'AI & Machine Learning', 'Nexovia builds applied AI products for healthcare and logistics.', '🧠', true),
  ('Quanticore Systems', 'https://quanticore.example.com', 'Cloud Infrastructure', 'Quanticore runs planet-scale cloud services and developer tooling.', '⚡', true),
  ('Aureon Analytics', 'https://aureon.example.com', 'Data & FinTech', 'Aureon turns financial data into decisions for global banks.', '📊', true),
  ('Skyforge Aerospace', 'https://skyforge.example.com', 'Aerospace & Defence', 'Skyforge designs next-generation avionics and satellite systems.', '🛰️', true),
  ('Bramblewood Retail', 'https://bramblewood.example.com', 'E-Commerce', 'Bramblewood operates omnichannel retail across 40 cities.', '🛍️', true),
  ('Helios Energy', 'https://helios.example.com', 'Clean Energy', 'Helios develops solar and grid-storage infrastructure.', '☀️', true);

insert into public.jobs (company_id, title, description, job_type, location, work_mode, ctc_min, ctc_max, stipend, eligible_branches, min_cgpa, min_grad_year, max_grad_year, openings, deadline, status) values
  ((select id from public.companies where name = 'Nexovia Labs'), 'Machine Learning Engineer', 'Join the applied research pod building vision and NLP models shipped in production healthcare tools. You will train, evaluate and deploy models with the MLOps team.', 'full-time', 'Bengaluru', 'hybrid', 12, 18, null, '{CSE,IT,AI-ML}', 7.5, 2025, null, 4, now() + interval '21 days', 'open'),
  ((select id from public.companies where name = 'Nexovia Labs'), 'AI Research Intern', 'Work with senior researchers on retrieval-augmented generation and evaluation pipelines. Publication support provided.', 'internship', 'Remote', 'remote', null, null, 40000, '{CSE,IT,ECE,AI-ML,Mathematics}', 8.0, null, null, 2, now() + interval '12 days', 'open'),
  ((select id from public.companies where name = 'Quanticore Systems'), 'Backend Engineer — Platform', 'Build the control plane that provisions infrastructure for 30k+ engineering teams. Go, PostgreSQL, Kubernetes.', 'full-time', 'Hyderabad', 'onsite', 14, 22, null, '{CSE,IT}', 7.0, 2024, 2026, 6, now() + interval '28 days', 'open'),
  ((select id from public.companies where name = 'Quanticore Systems'), 'Cloud Reliability Intern', 'Shadow the SRE bench: incident response drills, observability dashboards and automation scripts.', 'internship', 'Pune', 'hybrid', null, null, 35000, '{CSE,IT,ECE}', 6.5, null, null, 3, now() + interval '9 days', 'open'),
  ((select id from public.companies where name = 'Aureon Analytics'), 'Data Analyst', 'Own dashboards and risk models used by trading desks in three continents. SQL, Python, storytelling.', 'full-time', 'Mumbai', 'hybrid', 9, 13, null, '{CSE,IT,Mathematics,Statistics,ECE}', 7.0, 2025, null, 5, now() + interval '18 days', 'open'),
  ((select id from public.companies where name = 'Skyforge Aerospace'), 'Embedded Systems Engineer', 'Design firmware for flight-control boards. C/C++, RTOS, hardware bring-up on real satellites.', 'full-time', 'Thiruvananthapuram', 'onsite', 10, 15, null, '{ECE,EEE,Mechatronics,Aerospace}', 7.5, 2024, 2026, 3, now() + interval '25 days', 'open'),
  ((select id from public.companies where name = 'Bramblewood Retail'), 'Product Management Trainee', 'Rotate through catalog, pricing and growth squads. Ship one customer-facing feature per rotation.', 'full-time', 'Gurugram', 'onsite', 8, 11, null, '{}', 6.0, 2025, null, 8, now() + interval '15 days', 'open'),
  ((select id from public.companies where name = 'Helios Energy'), 'Full-Stack Developer', 'Build the monitoring console for 2 GW of installed solar capacity. React, TypeScript, TimescaleDB.', 'full-time', 'Ahmedabad', 'hybrid', 7.5, 12, null, '{CSE,IT,ECE}', 6.5, 2024, 2027, 4, now() + interval '30 days', 'open'),
  ((select id from public.companies where name = 'Aureon Analytics'), 'Quant Research Intern', 'Six-month paid internship on market-microstructure research with a conversion track.', 'internship', 'Mumbai', 'onsite', null, null, 50000, '{CSE,Mathematics,Statistics}', 8.5, null, 2027, 2, now() - interval '2 days', 'closed');
