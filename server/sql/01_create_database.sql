-- MySQL Workbench
-- 1. Connect to your local MySQL instance as root (or another admin user).
-- 2. Open this file and execute it (lightning bolt).
-- 3. Start the API. On an empty tdcp_rms database it creates the tables and seed logins.

CREATE DATABASE IF NOT EXISTS tdcp_rms
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'tdcp'@'localhost' IDENTIFIED BY 'tdcp123';
CREATE USER IF NOT EXISTS 'tdcp'@'127.0.0.1' IDENTIFIED BY 'tdcp123';

GRANT ALL PRIVILEGES ON tdcp_rms.* TO 'tdcp'@'localhost';
GRANT ALL PRIVILEGES ON tdcp_rms.* TO 'tdcp'@'127.0.0.1';
FLUSH PRIVILEGES;

-- Connection the app uses (server/.env):
-- mysql://tdcp:tdcp123@127.0.0.1:3306/tdcp_rms
