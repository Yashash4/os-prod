-- Add Nithish to hr_employees so he appears under Sales Reps in the pipeline

INSERT INTO hr_employees (user_id, full_name, email, is_sales_rep, status, employment_type, join_date)
SELECT
  u.id,
  'Nithish',
  'nithishsheshagiri@gmail.com',
  true,
  'active',
  'full_time',
  CURRENT_DATE
FROM public.users u
WHERE u.email = 'nithishsheshagiri@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET is_sales_rep = true;
