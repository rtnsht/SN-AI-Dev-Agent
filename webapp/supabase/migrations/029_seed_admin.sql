-- Seed the initial admin user once at the database layer.
-- The password is intentionally NOT stored here. The admin sets it via the
-- normal forgot-password or break-glass flow on first access.

INSERT INTO users (email, name, role, status, password_hash, must_set_password)
VALUES (
  'ratneshworkspace@gmail.com',
  'Ratnesh Tiwari',
  'admin',
  'active',
  NULL,
  true
)
ON CONFLICT DO NOTHING;

UPDATE users
SET role = 'admin',
    status = 'active'
WHERE lower(email) = 'ratneshworkspace@gmail.com'
  AND (role <> 'admin' OR status <> 'active');
