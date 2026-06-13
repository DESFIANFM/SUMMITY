ALTER TABLE simaksi DROP CONSTRAINT IF EXISTS chk_status_simaksi;
ALTER TABLE simaksi ADD CONSTRAINT chk_status_simaksi
  CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'checkin', 'checkout', 'complete'));
