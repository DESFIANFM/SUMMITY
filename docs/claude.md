-- =====================================================
-- TRACKING HISTORY
-- =====================================================

CREATE TABLE tracking_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relasi peserta
    ticket_id UUID NOT NULL,
    user_id UUID NOT NULL,

    -- Pos yang discan
    pos_id UUID NOT NULL,

    -- Waktu scan dari device
    scanned_at TIMESTAMPTZ NOT NULL,

    -- Device pendaki
    device_id VARCHAR(255),

    -- Status sinkronisasi
    is_offline BOOLEAN NOT NULL DEFAULT FALSE,
    synced_at TIMESTAMPTZ,

    -- Status validasi
    validation_status VARCHAR(50) NOT NULL DEFAULT 'valid',

    -- Catatan tambahan
    notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    -- Foreign Keys
    CONSTRAINT fk_tracking_history_ticket
        FOREIGN KEY (ticket_id)
        REFERENCES tickets(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_tracking_history_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_tracking_history_pos
        FOREIGN KEY (pos_id)
        REFERENCES pos(id),

    CONSTRAINT fk_tracking_history_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Pencarian tracking per tiket
CREATE INDEX idx_tracking_history_ticket_id
    ON tracking_history(ticket_id);

-- Pencarian tracking per user
CREATE INDEX idx_tracking_history_user_id
    ON tracking_history(user_id);

-- Pencarian tracking per pos
CREATE INDEX idx_tracking_history_pos_id
    ON tracking_history(pos_id);

-- Timeline tracking peserta
CREATE INDEX idx_tracking_history_scanned_at
    ON tracking_history(scanned_at DESC);

-- Tracking peserta berdasarkan user + waktu
CREATE INDEX idx_tracking_history_user_scanned
    ON tracking_history(user_id, scanned_at DESC);

-- Tracking tiket berdasarkan waktu
CREATE INDEX idx_tracking_history_ticket_scanned
    ON tracking_history(ticket_id, scanned_at DESC);

-- Monitoring pos
CREATE INDEX idx_tracking_history_pos_scanned
    ON tracking_history(pos_id, scanned_at DESC);

-- Sinkronisasi offline
CREATE INDEX idx_tracking_history_sync
    ON tracking_history(is_offline, synced_at);

-- Validasi data
CREATE INDEX idx_tracking_history_validation
    ON tracking_history(validation_status);