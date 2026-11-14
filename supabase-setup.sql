-- ==============================================================================
-- SUPABASE DATABASE SETUP FOR PRESENTER APP
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Create Enum for User Roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'mentor', 'student');
  END IF;
END $$;

-- 2. Create Sequences for Role Numbers (One sequence per role, IDs are never reused)
CREATE SEQUENCE IF NOT EXISTS seq_role_no_admin START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS seq_role_no_mentor START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS seq_role_no_student START WITH 1 INCREMENT BY 1;

-- 3. Create profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role user_role NOT NULL,
  role_no integer NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  auth_id uuid UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_profiles_role_role_no UNIQUE (role, role_no)
);

-- Ensure Unique Constraint on email (supports existing tables and fresh runs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_profiles_email'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT uq_profiles_email UNIQUE (email);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN others THEN NULL;
END $$;

-- 4. Trigger to Auto-Assign role_no from the Respective Sequence and Lowercase email
CREATE OR REPLACE FUNCTION public.trg_profiles_set_role_no()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize email to lowercase and trim spaces
  NEW.email := lower(trim(NEW.email));

  -- Auto-assign role_no if not provided
  IF NEW.role_no IS NULL THEN
    IF NEW.role = 'admin' THEN
      NEW.role_no := nextval('public.seq_role_no_admin');
    ELSIF NEW.role = 'mentor' THEN
      NEW.role_no := nextval('public.seq_role_no_mentor');
    ELSIF NEW.role = 'student' THEN
      NEW.role_no := nextval('public.seq_role_no_student');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_role_no ON public.profiles;
CREATE TRIGGER trg_profiles_role_no
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_profiles_set_role_no();

-- 5. Row Level Security (RLS) & Direct Access Revocation
-- Revoke direct table operations from anon, authenticated, and public roles.
-- The browser cannot query profiles directly; it can only call get_my_profile().
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated, public;

-- 6. get_my_profile() Function
-- Security Definer with search_path set.
-- Finds the profile by auth_id, or by verified email if auth_id is empty,
-- and links auth_id on the person's first sign-in.
-- Returns id, role, role_no, and name only.
-- Returns nothing if missing or inactive.
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (
  id bigint,
  role user_role,
  role_no integer,
  name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_auth_id uuid;
  v_email text;
  v_profile_id bigint;
  v_is_active boolean;
BEGIN
  -- 1. Identify current authenticated user from auth.uid()
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RETURN;
  END IF;

  -- 2. Try finding existing profile linked to this auth_id
  SELECT p.id, p.is_active
  INTO v_profile_id, v_is_active
  FROM public.profiles p
  WHERE p.auth_id = v_auth_id;

  -- 3. If not found by auth_id, check for verified email where auth_id IS NULL
  IF v_profile_id IS NULL THEN
    -- Look up email from auth.users
    SELECT lower(trim(u.email))
    INTO v_email
    FROM auth.users u
    WHERE u.id = v_auth_id;

    -- Fallback to JWT email claim
    IF v_email IS NULL THEN
      v_email := lower(trim(auth.jwt() ->> 'email'));
    END IF;

    IF v_email IS NOT NULL THEN
      SELECT p.id, p.is_active
      INTO v_profile_id, v_is_active
      FROM public.profiles p
      WHERE lower(p.email) = v_email AND p.auth_id IS NULL;

      -- On first sign-in, link auth_id if profile is active
      IF v_profile_id IS NOT NULL AND v_is_active = true THEN
        UPDATE public.profiles
        SET auth_id = v_auth_id
        WHERE public.profiles.id = v_profile_id;
      END IF;
    END IF;
  END IF;

  -- 4. Return profile only if found and active
  IF v_profile_id IS NOT NULL AND v_is_active = true THEN
    RETURN QUERY
    SELECT p.id, p.role, p.role_no, p.name
    FROM public.profiles p
    WHERE p.id = v_profile_id;
  END IF;

  RETURN;
END;
$$;

-- Grant execution to authenticated users only
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM anon, public;

-- 7. Supabase Auth "Before User Created" Hook
-- Stops strangers from creating accounts: rejects any email not pre-registered in profiles.
CREATE OR REPLACE FUNCTION public.hook_before_user_created(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text;
  v_exists boolean;
BEGIN
  v_email := lower(trim(coalesce(event->'user'->>'email', '')));

  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(email) = v_email AND is_active = true
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'This Google account is not registered. Please contact your Admin.';
  END IF;

  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.hook_before_user_created(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.hook_before_user_created(jsonb) FROM public, anon, authenticated;

-- 8. Seed Admin Account
-- Display ID will be ADM-0001 (role_no auto-assigned from seq_role_no_admin)
-- Uses WHERE NOT EXISTS to guarantee safe, idempotent execution without 42P10 constraint errors.
INSERT INTO public.profiles (name, email, role, is_active)
SELECT 'Ponraj kannan', 'ponrajacc@gmail.com', 'admin', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE lower(email) = 'ponrajacc@gmail.com'
);

-- ==============================================================================
-- READY-TO-EDIT SNIPPETS FOR ADDING NEW USERS
-- (Run as needed in Supabase SQL Editor when adding new people)
-- ==============================================================================

-- Example: Add a new Mentor
-- INSERT INTO public.profiles (name, email, role, is_active)
-- VALUES ('Mentor Name', 'mentor@gmail.com', 'mentor', true);

-- Example: Add a new Student
-- INSERT INTO public.profiles (name, email, role, is_active)
-- VALUES ('Student Name', 'student@gmail.com', 'student', true);

-- Fallback cleanup query (if Before User Created hook is unavailable on your plan):
-- Removes any stray auth users who signed in via Google but do not exist in profiles:
-- DELETE FROM auth.users
-- WHERE id NOT IN (SELECT auth_id FROM public.profiles WHERE auth_id IS NOT NULL);
