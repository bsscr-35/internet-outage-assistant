-- Optional, destructive cleanup of legacy operational records.
-- Review the preview queries and take a backup before running this file.
-- Only records with NULL OwnerUserID are removed; user accounts, credentials,
-- services, and user-service reference data are preserved.

SET @confirm_remove_unowned_demo_records := 'NO';

SELECT
  (SELECT COUNT(*) FROM outage WHERE OwnerUserID IS NULL) AS unownedOutages,
  (SELECT COUNT(*) FROM recovery_action AS ra
   INNER JOIN outage AS o ON o.OutageID = ra.OutageID
   WHERE o.OwnerUserID IS NULL) AS unownedRecoveryActions,
  (SELECT COUNT(*) FROM recovery_log AS rl
   INNER JOIN recovery_action AS ra ON ra.ActionID = rl.ActionID
   INNER JOIN outage AS o ON o.OutageID = ra.OutageID
   WHERE o.OwnerUserID IS NULL) AS unownedRecoveryLogs,
  (SELECT COUNT(*) FROM recovery_status_audit AS rsa
   INNER JOIN recovery_action AS ra ON ra.ActionID = rsa.ActionID
   INNER JOIN outage AS o ON o.OutageID = ra.OutageID
   WHERE o.OwnerUserID IS NULL) AS unownedRecoveryAudits,
  (SELECT COUNT(*) FROM outage_impact AS oi
   INNER JOIN outage AS o ON o.OutageID = oi.OutageID
   WHERE o.OwnerUserID IS NULL) AS unownedImpacts,
  (SELECT COUNT(*) FROM service_verification AS sv
   INNER JOIN outage AS o ON o.OutageID = sv.OutageID
   WHERE o.OwnerUserID IS NULL) AS unownedVerifications,
  (SELECT COUNT(*) FROM maintenance AS m
   INNER JOIN network_component AS nc ON nc.ComponentID = m.ComponentID
   WHERE nc.OwnerUserID IS NULL) AS unownedMaintenance,
  (SELECT COUNT(*) FROM dependency AS d
   WHERE EXISTS (
     SELECT 1 FROM network_component AS nc
     WHERE nc.ComponentID IN (d.ComponentID, d.DependsOnID)
       AND nc.OwnerUserID IS NULL
   )) AS unownedDependencies,
  (SELECT COUNT(*) FROM hint AS h
   INNER JOIN outage AS o ON o.OutageID = h.OutageID
   WHERE o.OwnerUserID IS NULL) AS unownedHints,
  (SELECT COUNT(*) FROM network_component AS nc
   WHERE nc.OwnerUserID IS NULL
     AND NOT EXISTS (SELECT 1 FROM outage AS o WHERE o.ComponentID = nc.ComponentID)
  ) AS deletableComponents,
  (SELECT COUNT(*) FROM location AS l
   WHERE l.OwnerUserID IS NULL
     AND NOT EXISTS (SELECT 1 FROM network_component AS nc WHERE nc.LocationID = l.LocationID)
  ) AS deletableLocations;

START TRANSACTION;

DELETE FROM recovery_log
WHERE @confirm_remove_unowned_demo_records = 'YES'
  AND ActionID IN (
  SELECT ActionID
  FROM recovery_action
  WHERE OutageID IN (SELECT OutageID FROM outage WHERE OwnerUserID IS NULL)
);

DELETE FROM recovery_status_audit
WHERE @confirm_remove_unowned_demo_records = 'YES'
  AND ActionID IN (
  SELECT ActionID
  FROM recovery_action
  WHERE OutageID IN (SELECT OutageID FROM outage WHERE OwnerUserID IS NULL)
);

DELETE FROM service_verification
WHERE @confirm_remove_unowned_demo_records = 'YES'
  AND OutageID IN (SELECT OutageID FROM outage WHERE OwnerUserID IS NULL);

DELETE FROM outage_impact
WHERE @confirm_remove_unowned_demo_records = 'YES'
  AND OutageID IN (SELECT OutageID FROM outage WHERE OwnerUserID IS NULL);

DELETE FROM recovery_action
WHERE @confirm_remove_unowned_demo_records = 'YES'
  AND OutageID IN (SELECT OutageID FROM outage WHERE OwnerUserID IS NULL);

DELETE FROM hint
WHERE @confirm_remove_unowned_demo_records = 'YES'
  AND OutageID IN (SELECT OutageID FROM outage WHERE OwnerUserID IS NULL);

DELETE FROM outage
WHERE @confirm_remove_unowned_demo_records = 'YES'
  AND OwnerUserID IS NULL;

DELETE FROM maintenance
WHERE @confirm_remove_unowned_demo_records = 'YES'
  AND ComponentID IN (
  SELECT ComponentID FROM network_component WHERE OwnerUserID IS NULL
);

DELETE FROM dependency
WHERE @confirm_remove_unowned_demo_records = 'YES'
  AND (ComponentID IN (
  SELECT ComponentID FROM network_component WHERE OwnerUserID IS NULL
) OR DependsOnID IN (
  SELECT ComponentID FROM network_component WHERE OwnerUserID IS NULL
));

DELETE FROM network_component AS nc
WHERE @confirm_remove_unowned_demo_records = 'YES'
  AND nc.OwnerUserID IS NULL
  AND NOT EXISTS (SELECT 1 FROM outage AS o WHERE o.ComponentID = nc.ComponentID);

DELETE FROM location AS l
WHERE @confirm_remove_unowned_demo_records = 'YES'
  AND l.OwnerUserID IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM network_component AS nc WHERE nc.LocationID = l.LocationID
  );

COMMIT;
