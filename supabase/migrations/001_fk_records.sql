-- Kør i Supabase SQL Editor (projekt Familiekursus, EU).
-- Persondata: RLS på, ingen anon-adgang — kun service role fra Vercel.

create table if not exists public.fk_records (
  id text primary key,
  table_key text not null,
  fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fk_records_table_key_idx on public.fk_records (table_key);

create table if not exists public.fk_table_schema (
  table_key text primary key,
  field_names text[] not null default '{}'
);

comment on table public.fk_records is 'Familiekursus rækker (tidligere Airtable), fields = kolonnenavne som i Airtable';

alter table public.fk_records enable row level security;
alter table public.fk_table_schema enable row level security;

grant usage on schema public to postgres, service_role;
grant select, insert, update, delete on public.fk_records to service_role;
grant select, insert, update, delete on public.fk_table_schema to service_role;

create or replace function public.set_fk_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists fk_records_updated_at on public.fk_records;
create trigger fk_records_updated_at
  before update on public.fk_records
  for each row
  execute function public.set_fk_records_updated_at();

-- Privat bucket til Mød os-portrætter (server-proxy, ikke offentlig).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'moed-os',
  'moed-os',
  false,
  4718592,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
