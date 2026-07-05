-- ============================================================
-- Menu3D QR — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================================
-- RESTAURANTS
-- ============================================================
create table if not exists public.restaurants (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  slug text unique not null,
  logo_url text,
  cuisine text,
  currency text default 'USD' not null,
  phone text,
  whatsapp text,
  address text,
  description text,
  website text,
  status text default 'active' check (status in ('active', 'inactive', 'suspended')) not null,
  brand_primary_color text default '#E85D04',
  brand_secondary_color text default '#F48C06',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_restaurants_owner_id on public.restaurants(owner_id);
create index idx_restaurants_slug on public.restaurants(slug);

-- ============================================================
-- RESTAURANT MEMBERS
-- ============================================================
create table if not exists public.restaurant_members (
  id uuid default uuid_generate_v4() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'viewer' check (role in ('owner', 'admin', 'editor', 'viewer')) not null,
  created_at timestamptz default now() not null,
  unique(restaurant_id, user_id)
);

create index idx_restaurant_members_restaurant_id on public.restaurant_members(restaurant_id);
create index idx_restaurant_members_user_id on public.restaurant_members(user_id);

-- ============================================================
-- MENU UPLOADS
-- ============================================================
create table if not exists public.menu_uploads (
  id uuid default uuid_generate_v4() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  file_url text not null,
  file_type text check (file_type in ('pdf', 'jpg', 'jpeg', 'png')) not null,
  file_name text,
  file_size_bytes bigint,
  extraction_status text default 'pending' check (extraction_status in ('pending', 'processing', 'completed', 'failed')) not null,
  extracted_json jsonb,
  extraction_error text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_menu_uploads_restaurant_id on public.menu_uploads(restaurant_id);

-- ============================================================
-- MENUS
-- ============================================================
create table if not exists public.menus (
  id uuid default uuid_generate_v4() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  name text not null default 'Main Menu',
  status text default 'draft' check (status in ('draft', 'published', 'archived')) not null,
  version integer default 1 not null,
  published_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_menus_restaurant_id on public.menus(restaurant_id);
create index idx_menus_status on public.menus(status);

-- ============================================================
-- MENU CATEGORIES
-- ============================================================
create table if not exists public.menu_categories (
  id uuid default uuid_generate_v4() primary key,
  menu_id uuid references public.menus(id) on delete cascade not null,
  name text not null,
  description text,
  sort_order integer default 0 not null,
  is_active boolean default true not null,
  image_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_menu_categories_menu_id on public.menu_categories(menu_id);
create index idx_menu_categories_sort_order on public.menu_categories(sort_order);

-- ============================================================
-- MENU ITEMS
-- ============================================================
create table if not exists public.menu_items (
  id uuid default uuid_generate_v4() primary key,
  category_id uuid references public.menu_categories(id) on delete cascade not null,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  image_url text,
  is_available boolean default true not null,
  is_veg boolean default false not null,
  is_featured boolean default false not null,
  spice_level integer default 0 check (spice_level between 0 and 3) not null,
  calories integer,
  allergens text[] default '{}',
  tags text[] default '{}',
  sort_order integer default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_menu_items_category_id on public.menu_items(category_id);
create index idx_menu_items_is_available on public.menu_items(is_available);
create index idx_menu_items_is_featured on public.menu_items(is_featured);
create index idx_menu_items_sort_order on public.menu_items(sort_order);

-- ============================================================
-- THEMES
-- ============================================================
create table if not exists public.themes (
  id uuid default uuid_generate_v4() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  name text default 'Modern Dark' not null,
  primary_color text default '#E85D04' not null,
  accent_color text default '#F48C06' not null,
  background_color text default '#0A0A0A' not null,
  text_color text default '#FFFFFF' not null,
  font_family text default 'Inter' not null,
  layout_style text default 'grid' check (layout_style in ('grid', 'list', 'magazine')) not null,
  card_style text default 'elevated' check (card_style in ('flat', 'elevated', 'glass')) not null,
  animation_style text default 'subtle' check (animation_style in ('none', 'subtle', 'lively')) not null,
  custom_css_json jsonb default '{}',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(restaurant_id)
);

create index idx_themes_restaurant_id on public.themes(restaurant_id);

-- ============================================================
-- QR CODES
-- ============================================================
create table if not exists public.qr_codes (
  id uuid default uuid_generate_v4() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  menu_id uuid references public.menus(id) on delete cascade not null,
  code text unique not null,
  target_url text not null,
  table_label text,
  scan_count integer default 0 not null,
  qr_png_url text,
  qr_svg_url text,
  is_active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_qr_codes_restaurant_id on public.qr_codes(restaurant_id);
create index idx_qr_codes_code on public.qr_codes(code);

-- ============================================================
-- QR SCANS
-- ============================================================
create table if not exists public.qr_scans (
  id uuid default uuid_generate_v4() primary key,
  qr_code_id uuid references public.qr_codes(id) on delete cascade not null,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  menu_id uuid references public.menus(id) on delete set null,
  table_label text,
  user_agent text,
  ip_address inet,
  country text,
  city text,
  device_type text check (device_type in ('mobile', 'tablet', 'desktop', 'unknown')) default 'unknown',
  referer text,
  scanned_at timestamptz default now() not null
);

create index idx_qr_scans_qr_code_id on public.qr_scans(qr_code_id);
create index idx_qr_scans_restaurant_id on public.qr_scans(restaurant_id);
create index idx_qr_scans_scanned_at on public.qr_scans(scanned_at);

-- ============================================================
-- ORDERS
-- ============================================================
create table if not exists public.orders (
  id uuid default uuid_generate_v4() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  menu_id uuid references public.menus(id) on delete set null,
  table_label text,
  customer_name text,
  customer_phone text,
  status text default 'pending' check (status in ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')) not null,
  subtotal numeric(10,2) default 0 not null,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_orders_restaurant_id on public.orders(restaurant_id);
create index idx_orders_status on public.orders(status);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
create table if not exists public.order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  quantity integer default 1 not null,
  price_snapshot numeric(10,2) not null,
  notes text,
  created_at timestamptz default now() not null
);

create index idx_order_items_order_id on public.order_items(order_id);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
create table if not exists public.subscriptions (
  id uuid default uuid_generate_v4() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  plan text default 'free' check (plan in ('free', 'pro', 'enterprise')) not null,
  status text default 'active' check (status in ('active', 'cancelled', 'past_due', 'trialing')) not null,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(restaurant_id)
);

create index idx_subscriptions_restaurant_id on public.subscriptions(restaurant_id);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
create table if not exists public.audit_logs (
  id uuid default uuid_generate_v4() primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb default '{}',
  created_at timestamptz default now() not null
);

create index idx_audit_logs_restaurant_id on public.audit_logs(restaurant_id);
create index idx_audit_logs_actor_id on public.audit_logs(actor_id);
create index idx_audit_logs_created_at on public.audit_logs(created_at);

-- ============================================================
-- TRIGGERS: updated_at auto-update
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_updated_at_profiles
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger handle_updated_at_restaurants
  before update on public.restaurants
  for each row execute function public.handle_updated_at();

create trigger handle_updated_at_menu_uploads
  before update on public.menu_uploads
  for each row execute function public.handle_updated_at();

create trigger handle_updated_at_menus
  before update on public.menus
  for each row execute function public.handle_updated_at();

create trigger handle_updated_at_menu_categories
  before update on public.menu_categories
  for each row execute function public.handle_updated_at();

create trigger handle_updated_at_menu_items
  before update on public.menu_items
  for each row execute function public.handle_updated_at();

create trigger handle_updated_at_themes
  before update on public.themes
  for each row execute function public.handle_updated_at();

create trigger handle_updated_at_qr_codes
  before update on public.qr_codes
  for each row execute function public.handle_updated_at();

create trigger handle_updated_at_orders
  before update on public.orders
  for each row execute function public.handle_updated_at();

create trigger handle_updated_at_subscriptions
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

-- ============================================================
-- TRIGGER: Auto-create profile on user signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
