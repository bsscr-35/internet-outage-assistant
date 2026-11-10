-- Replace the password placeholder with a random password before running.
-- Apply only after 001_auth_credentials.sql has been reviewed and applied.
-- This file creates/grants a local application account; it does not modify data.

CREATE USER IF NOT EXISTS 'outage_assistant_app'@'localhost'
  IDENTIFIED BY 'REPLACE_WITH_RANDOM_HEX_PASSWORD';

GRANT SELECT ON outage_assistant_demo.`user`
  TO 'outage_assistant_app'@'localhost';
GRANT SELECT ON outage_assistant_demo.auth_credential
  TO 'outage_assistant_app'@'localhost';
GRANT SELECT ON outage_assistant_demo.outage
  TO 'outage_assistant_app'@'localhost';
GRANT SELECT ON outage_assistant_demo.network_component
  TO 'outage_assistant_app'@'localhost';
GRANT SELECT ON outage_assistant_demo.location
  TO 'outage_assistant_app'@'localhost';
GRANT SELECT ON outage_assistant_demo.outage_impact
  TO 'outage_assistant_app'@'localhost';
GRANT SELECT ON outage_assistant_demo.service
  TO 'outage_assistant_app'@'localhost';
GRANT SELECT ON outage_assistant_demo.recovery_action
  TO 'outage_assistant_app'@'localhost';
GRANT SELECT ON outage_assistant_demo.recovery_log
  TO 'outage_assistant_app'@'localhost';
GRANT SELECT ON outage_assistant_demo.recovery_status_audit
  TO 'outage_assistant_app'@'localhost';
GRANT SELECT ON outage_assistant_demo.service_verification
  TO 'outage_assistant_app'@'localhost';

GRANT INSERT ON outage_assistant_demo.`user`
  TO 'outage_assistant_app'@'localhost';
GRANT INSERT ON outage_assistant_demo.auth_credential
  TO 'outage_assistant_app'@'localhost';
GRANT INSERT ON outage_assistant_demo.outage
  TO 'outage_assistant_app'@'localhost';
GRANT INSERT ON outage_assistant_demo.outage_impact
  TO 'outage_assistant_app'@'localhost';
GRANT INSERT ON outage_assistant_demo.recovery_status_audit
  TO 'outage_assistant_app'@'localhost';
GRANT INSERT ON outage_assistant_demo.recovery_log
  TO 'outage_assistant_app'@'localhost';

GRANT UPDATE ON outage_assistant_demo.outage
  TO 'outage_assistant_app'@'localhost';
GRANT UPDATE ON outage_assistant_demo.recovery_action
  TO 'outage_assistant_app'@'localhost';
