-- MySQL Workbench
-- Optional. The API applies database_reset.sql itself the first time it starts
-- and the organizations table is missing.
-- To build the schema by hand: connect to tdcp_rms, then open and run
-- the project file database_reset.sql.

USE tdcp_rms;
SELECT DATABASE() AS connected_database;
