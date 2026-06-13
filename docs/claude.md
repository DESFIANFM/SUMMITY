ALTER TABLE tracking_history
DROP CONSTRAINT fk_tracking_history_pos;

ALTER TABLE tracking_history
ALTER COLUMN pos_id TYPE BIGINT USING pos_id::BIGINT;

ALTER TABLE tracking_history
ADD CONSTRAINT fk_tracking_history_pos
FOREIGN KEY (pos_id)
REFERENCES pos(id);