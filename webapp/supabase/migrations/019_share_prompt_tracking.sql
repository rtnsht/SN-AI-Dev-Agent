create table if not exists public.share_prompt_tracking (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  shown_count integer not null default 0 check (shown_count >= 0 and shown_count <= 10),
  last_shown_at timestamptz,
  shared_at timestamptz,
  platform text check (platform is null or platform in ('linkedin', 'x')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_share_prompt_tracking_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_share_prompt_tracking_updated_at on public.share_prompt_tracking;

create trigger trg_share_prompt_tracking_updated_at
before update on public.share_prompt_tracking
for each row
execute function public.touch_share_prompt_tracking_updated_at();
