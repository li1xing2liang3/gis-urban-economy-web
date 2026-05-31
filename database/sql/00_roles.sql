-- 应用账号（Docker / 本地 init 共用）
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'gis_app') THEN
    CREATE ROLE gis_app LOGIN PASSWORD 'gis_app_dev';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE gis_economy TO gis_app;
