CREATE TABLE auth_user (id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, email_verified boolean NOT NULL DEFAULT false, image text, two_factor_enabled boolean DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE auth_session (id text PRIMARY KEY, token text NOT NULL UNIQUE, user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), ip_address text, user_agent text);
CREATE TABLE auth_account (id text PRIMARY KEY, account_id text NOT NULL, provider_id text NOT NULL, user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, access_token text, refresh_token text, id_token text, access_token_expires_at timestamptz, refresh_token_expires_at timestamptz, scope text, password text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider_id,account_id));
CREATE TABLE auth_verification (id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE auth_two_factor (id text PRIMARY KEY, secret text NOT NULL, backup_codes text NOT NULL, user_id text NOT NULL UNIQUE REFERENCES auth_user(id) ON DELETE CASCADE);
CREATE TABLE auth_rate_limit (id text PRIMARY KEY, key text NOT NULL UNIQUE, count integer NOT NULL, last_request bigint NOT NULL);
CREATE INDEX auth_session_user_idx ON auth_session(user_id);
CREATE INDEX auth_account_user_idx ON auth_account(user_id);
CREATE INDEX auth_verification_identifier_idx ON auth_verification(identifier);
CREATE TABLE legal_entities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE activities (id text PRIMARY KEY, legal_entity_id uuid REFERENCES legal_entities(id), name text NOT NULL, settings jsonb NOT NULL DEFAULT '{}');
INSERT INTO activities(id,name) VALUES('bitg','Beck In The Gym');
CREATE TABLE memberships (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, activity_id text NOT NULL REFERENCES activities(id), role text NOT NULL CHECK(role IN ('owner')), UNIQUE(user_id,activity_id));
CREATE TABLE contact_requests (id uuid PRIMARY KEY, activity_id text NOT NULL REFERENCES activities(id), name text NOT NULL CHECK(length(name) BETWEEN 2 AND 100), email text NOT NULL CHECK(length(email)<=254), phone text CHECK(length(phone)<=30), goal text NOT NULL CHECK(goal IN ('strength','muscle','fitness','technique','unsure')), experience text, format text, message text CHECK(length(message)<=2000), locale text NOT NULL CHECK(locale IN ('nl','en')), status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','contacted','closed')), version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), retention_at timestamptz NOT NULL);
CREATE INDEX contact_activity_created_idx ON contact_requests(activity_id,created_at DESC);
CREATE INDEX contact_retention_idx ON contact_requests(retention_at);
CREATE TABLE mail_outbox (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contact_id uuid NOT NULL REFERENCES contact_requests(id) ON DELETE CASCADE, kind text NOT NULL CHECK(kind IN ('owner','receipt')), attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz, sent_at timestamptz, provider_id text, UNIQUE(contact_id,kind));
CREATE INDEX mail_pending_idx ON mail_outbox(available_at) WHERE sent_at IS NULL;
CREATE TABLE rate_limits (key text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE audit_events (id uuid PRIMARY KEY, actor_id text, activity_id text NOT NULL REFERENCES activities(id), action text NOT NULL, subject_id text, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX audit_activity_created_idx ON audit_events(activity_id,created_at DESC);

CREATE FUNCTION submit_bitg_contact(p_id uuid,p_name text,p_email text,p_phone text,p_goal text,p_experience text,p_format text,p_message text,p_locale text,p_rate_key text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE current_hits integer;
BEGIN
  IF length(p_rate_key) != 64 THEN RAISE EXCEPTION 'Invalid rate identity'; END IF;
  INSERT INTO rate_limits(key,hits,expires_at) VALUES(p_rate_key,1,now()+interval '10 minutes')
  ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.expires_at<=now() THEN 1 ELSE rate_limits.hits+1 END, expires_at=CASE WHEN rate_limits.expires_at<=now() THEN now()+interval '10 minutes' ELSE rate_limits.expires_at END
  RETURNING hits INTO current_hits;
  IF current_hits>5 THEN RETURN false; END IF;
  INSERT INTO contact_requests(id,activity_id,name,email,phone,goal,experience,format,message,locale,retention_at)
  VALUES(p_id,'bitg',p_name,p_email,nullif(p_phone,''),p_goal,nullif(p_experience,''),nullif(p_format,''),nullif(p_message,''),p_locale,now()+interval '6 months') ON CONFLICT(id) DO NOTHING;
  -- Idempotent retries don't duplicate mail, and never reveal an existing request.
  INSERT INTO mail_outbox(contact_id,kind) SELECT p_id,kind FROM (VALUES('owner'),('receipt')) AS kinds(kind) WHERE EXISTS(SELECT 1 FROM contact_requests WHERE id=p_id) ON CONFLICT(contact_id,kind) DO NOTHING;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION submit_bitg_contact(uuid,text,text,text,text,text,text,text,text,text) FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
