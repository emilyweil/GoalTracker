create table user_data (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table user_data enable row level security;

create policy user_select on user_data for select using (auth.uid() = user_id);
create policy user_insert on user_data for insert with check (auth.uid() = user_id);
create policy user_update on user_data for update using (auth.uid() = user_id);
create policy user_delete on user_data for delete using (auth.uid() = user_id);
