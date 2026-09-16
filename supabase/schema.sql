-- Firefly Supabase foundation
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blog_comments (
  id bigint generated always as identity primary key,
  post_slug text not null,
  user_id uuid references auth.users(id) on delete set null,
  author_name text,
  content text not null check (char_length(content) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists blog_comments_post_slug_created_at_idx
  on public.blog_comments (post_slug, created_at);

create table if not exists public.user_files (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bucket text not null default 'user-uploads',
  path text not null,
  created_at timestamptz not null default now(),
  unique (user_id, bucket, path)
);

-- Also repair the default if the initial schema was already applied.
alter table public.user_files alter column user_id set default auth.uid();

alter table public.profiles enable row level security;
alter table public.blog_comments enable row level security;
alter table public.user_files enable row level security;

drop policy if exists "Profiles are public" on public.profiles;
create policy "Profiles are public" on public.profiles for select using (true);
drop policy if exists "Users create their profile" on public.profiles;
create policy "Users create their profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "Users update their profile" on public.profiles;
create policy "Users update their profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Comments are public" on public.blog_comments;
create policy "Comments are public" on public.blog_comments for select using (true);
drop policy if exists "Authenticated users create comments" on public.blog_comments;
create policy "Authenticated users create comments" on public.blog_comments for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update their comments" on public.blog_comments;
create policy "Users update their comments" on public.blog_comments for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete their comments" on public.blog_comments;
create policy "Users delete their comments" on public.blog_comments for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users read their file records" on public.user_files;
create policy "Users read their file records" on public.user_files for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users create file records" on public.user_files;
create policy "Users create file records" on public.user_files for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users delete file records" on public.user_files;
create policy "Users delete file records" on public.user_files for delete to authenticated using (auth.uid() = user_id);

-- Create the private bucket used by the account page.
insert into storage.buckets (id, name, public)
values ('user-uploads', 'user-uploads', false)
on conflict (id) do nothing;

drop policy if exists "Users upload their files" on storage.objects;
create policy "Users upload their files" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-uploads' and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists "Users read their files" on storage.objects;
create policy "Users read their files" on storage.objects for select to authenticated
  using (bucket_id = 'user-uploads' and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists "Users update their files" on storage.objects;
create policy "Users update their files" on storage.objects for update to authenticated
  using (bucket_id = 'user-uploads' and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists "Users delete their files" on storage.objects;
create policy "Users delete their files" on storage.objects for delete to authenticated
  using (bucket_id = 'user-uploads' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- Enable Realtime for comments (safe to run repeatedly).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'blog_comments'
  ) then
    alter publication supabase_realtime add table public.blog_comments;
  end if;
end
$$;
