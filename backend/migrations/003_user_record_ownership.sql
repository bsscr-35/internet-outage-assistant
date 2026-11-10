-- Add tenant ownership without assigning legacy records to any account.
-- Legacy records remain intact but are hidden from authenticated users until
-- an administrator explicitly assigns them an owner.

ALTER TABLE location
  ADD COLUMN OwnerUserID INT NULL AFTER Region,
  ADD INDEX idx_location_owner (OwnerUserID),
  ADD UNIQUE KEY uq_location_owner_name_region (OwnerUserID, LocationName, Region),
  ADD CONSTRAINT fk_location_owner
    FOREIGN KEY (OwnerUserID) REFERENCES `user` (UserID)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

ALTER TABLE network_component
  ADD COLUMN OwnerUserID INT NULL AFTER LocationID,
  ADD INDEX idx_component_owner (OwnerUserID),
  ADD UNIQUE KEY uq_component_owner_location_name_type
    (OwnerUserID, LocationID, ComponentName, ComponentType),
  ADD CONSTRAINT fk_component_owner
    FOREIGN KEY (OwnerUserID) REFERENCES `user` (UserID)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

ALTER TABLE outage
  ADD COLUMN OwnerUserID INT NULL AFTER ComponentID,
  ADD INDEX idx_outage_owner_detected (OwnerUserID, DetectedAt, OutageID),
  ADD CONSTRAINT fk_outage_owner
    FOREIGN KEY (OwnerUserID) REFERENCES `user` (UserID)
    ON UPDATE CASCADE
    ON DELETE SET NULL;
