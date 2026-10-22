-- Columns required by the installed Better Auth two-factor plugin (verification state and lockout).
ALTER TABLE auth_two_factor ADD COLUMN verified boolean DEFAULT true, ADD COLUMN failed_verification_count integer DEFAULT 0, ADD COLUMN locked_until timestamptz;
