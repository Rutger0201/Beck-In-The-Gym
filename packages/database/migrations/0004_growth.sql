-- Growth Pipeline: additive. Organisations, events and public pages only; no profiles of private persons.
ALTER TABLE marketing_runs DROP CONSTRAINT marketing_runs_job_check, ADD CONSTRAINT marketing_runs_job_check CHECK(job IN ('research','plan','growth','growth_digest','growth_draft'));
CREATE TABLE growth_settings (activity_id text PRIMARY KEY REFERENCES activities(id), settings jsonb NOT NULL DEFAULT '{}', version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO growth_settings(activity_id) VALUES('bitg');
CREATE TABLE growth_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), activity_id text NOT NULL REFERENCES activities(id),
  fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'), content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),
  title text NOT NULL CHECK(length(title) BETWEEN 3 AND 200), summary text NOT NULL DEFAULT '' CHECK(length(summary)<=1200),
  url text NOT NULL CHECK(url ~ '^https://' AND length(url)<=500), also_seen jsonb NOT NULL DEFAULT '[]',
  source text NOT NULL CHECK(length(source) BETWEEN 2 AND 120), source_kind text NOT NULL CHECK(source_kind IN ('news','rss','ical','jsonld','brave','google_cse')), query text CHECK(length(query)<=200),
  organisation text CHECK(length(organisation)<=200),
  category text NOT NULL CHECK(category IN ('client_demand','corporate','event','partnership','campaign','workshop')), category_locked boolean NOT NULL DEFAULT false,
  place text CHECK(length(place)<=200), lat double precision CHECK(lat BETWEEN -90 AND 90), lon double precision CHECK(lon BETWEEN -180 AND 180),
  geo_precision text CHECK(geo_precision IN ('exact','address','place')), distance_km numeric(6,1) CHECK(distance_km>=0),
  event_date date, published_at timestamptz,
  relevance smallint NOT NULL CHECK(relevance BETWEEN 1 AND 5), value smallint NOT NULL CHECK(value BETWEEN 1 AND 5), geography smallint NOT NULL CHECK(geography BETWEEN 1 AND 5),
  likelihood smallint NOT NULL CHECK(likelihood BETWEEN 1 AND 5), urgency smallint NOT NULL CHECK(urgency BETWEEN 1 AND 5), reliability smallint NOT NULL CHECK(reliability BETWEEN 1 AND 5),
  score smallint NOT NULL CHECK(score BETWEEN 0 AND 100), insight jsonb NOT NULL DEFAULT '{}',
  analysis_method text NOT NULL DEFAULT 'rules' CHECK(analysis_method IN ('rules','ai')), analysis_model text CHECK(length(analysis_model)<=80), analysed_hash text, analysed_at timestamptz,
  status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','interesting','contact','in_conversation','won','rejected')), status_changed_at timestamptz NOT NULL DEFAULT now(),
  follow_up_on date, is_demo boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(), seen_count integer NOT NULL DEFAULT 1,
  version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(activity_id,fingerprint)
);
CREATE INDEX growth_opportunities_feed_idx ON growth_opportunities(activity_id,status,score DESC);
CREATE INDEX growth_opportunities_follow_up_idx ON growth_opportunities(activity_id,follow_up_on) WHERE follow_up_on IS NOT NULL;
CREATE INDEX growth_opportunities_seen_idx ON growth_opportunities(activity_id,first_seen_at DESC);
CREATE TABLE growth_notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), activity_id text NOT NULL REFERENCES activities(id), opportunity_id uuid NOT NULL REFERENCES growth_opportunities(id) ON DELETE CASCADE, body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000), remind_on date, done boolean NOT NULL DEFAULT false, actor_id text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX growth_notes_opportunity_idx ON growth_notes(opportunity_id,created_at DESC);
CREATE INDEX growth_notes_remind_idx ON growth_notes(activity_id,remind_on) WHERE remind_on IS NOT NULL AND NOT done;
CREATE TABLE growth_drafts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), activity_id text NOT NULL REFERENCES activities(id), opportunity_id uuid NOT NULL REFERENCES growth_opportunities(id) ON DELETE CASCADE, kind text NOT NULL CHECK(kind IN ('proposal','email','campaign','intro','plan')), subject text NOT NULL CHECK(length(subject)<=200), body text NOT NULL CHECK(length(body) BETWEEN 1 AND 8000), method text NOT NULL CHECK(method IN ('ai','template')), model text CHECK(length(model)<=80), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','sent_manually','discarded')), version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX growth_drafts_opportunity_idx ON growth_drafts(opportunity_id,created_at DESC);
CREATE TABLE growth_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), activity_id text NOT NULL REFERENCES activities(id), opportunity_id uuid NOT NULL REFERENCES growth_opportunities(id) ON DELETE CASCADE, event text NOT NULL CHECK(length(event)<=40), details jsonb NOT NULL DEFAULT '{}', actor_id text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX growth_history_opportunity_idx ON growth_history(opportunity_id,created_at DESC);
CREATE TABLE growth_source_checks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), activity_id text NOT NULL REFERENCES activities(id), run_id uuid NOT NULL, key text NOT NULL CHECK(length(key)<=600), kind text NOT NULL, label text NOT NULL CHECK(length(label)<=300), ok boolean NOT NULL, items integer NOT NULL DEFAULT 0, error text CHECK(length(error)<=300), ms integer NOT NULL DEFAULT 0, checked_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX growth_source_checks_run_idx ON growth_source_checks(run_id);
CREATE INDEX growth_source_checks_key_idx ON growth_source_checks(activity_id,key,checked_at DESC);
