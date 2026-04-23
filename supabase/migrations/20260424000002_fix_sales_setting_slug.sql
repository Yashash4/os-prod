-- Fix slug/name mismatch for the Sales Setting module.
-- seed.sql inserted it as slug='pipeline-settings', name='Settings'
-- but modules.ts registers it as slug='sales-setting', name='Sales Setting'.
-- The permissions page and module tree both read from the DB, so align them.

UPDATE modules
SET
  slug        = 'sales-setting',
  name        = 'Sales Setting',
  description = 'Sales tracking sheets and settings',
  "order"     = 1
WHERE slug = 'pipeline-settings'
  AND parent_slug = 'pipeline';

-- If pipeline-settings didn't exist, insert sales-setting fresh
INSERT INTO modules (name, slug, description, icon, parent_slug, path, "order", is_active)
SELECT 'Sales Setting', 'sales-setting', 'Sales tracking sheets and settings', 'Settings', 'pipeline', '/m/sales/pipeline/settings', 1, true
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE slug = 'sales-setting');
