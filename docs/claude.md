DROP TABLE IF EXISTS tracking_history;
CREATE TABLE tracking_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL,
    user_id UUID NOT NULL,
    pos_id INTEGER NOT NULL,
    scanned_at TIMESTAMPTZ NOT NULL,
    device_id VARCHAR(255),
    is_offline BOOLEAN NOT NULL DEFAULT FALSE,
    synced_at TIMESTAMPTZ,
    validation_status VARCHAR(50) NOT NULL DEFAULT 'valid',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    CONSTRAINT fk_tracking_history_ticket
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_tracking_history_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_tracking_history_pos
        FOREIGN KEY (pos_id) REFERENCES pos(id),
    CONSTRAINT fk_tracking_history_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
);