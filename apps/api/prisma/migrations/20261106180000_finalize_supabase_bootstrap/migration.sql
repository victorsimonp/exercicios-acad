-- Remove the one-time credential provisioner after secure connection setup.
DROP FUNCTION IF EXISTS app_private.bootstrap_connection_credentials();
