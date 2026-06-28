-- Seed data for the data_items table.
-- Runs on every startup (spring.sql.init.mode=always).
-- INSERT ... WHERE NOT EXISTS prevents duplicates on restart.

INSERT INTO data_items (title, description)
SELECT 'Spring Boot', 'Java backend framework with embedded Tomcat and auto-configuration'
WHERE NOT EXISTS (SELECT 1 FROM data_items WHERE title = 'Spring Boot');

INSERT INTO data_items (title, description)
SELECT 'Next.js', 'React framework for production with SSR, App Router and API routes'
WHERE NOT EXISTS (SELECT 1 FROM data_items WHERE title = 'Next.js');

INSERT INTO data_items (title, description)
SELECT 'Azure MSAL', 'Microsoft Authentication Library for OAuth 2.0 and OpenID Connect'
WHERE NOT EXISTS (SELECT 1 FROM data_items WHERE title = 'Azure MSAL');

INSERT INTO data_items (title, description)
SELECT 'PostgreSQL', 'Open-source relational database — used via Neon serverless in production'
WHERE NOT EXISTS (SELECT 1 FROM data_items WHERE title = 'PostgreSQL');

INSERT INTO data_items (title, description)
SELECT 'Docker', 'Container platform for consistent builds and deployments'
WHERE NOT EXISTS (SELECT 1 FROM data_items WHERE title = 'Docker');
