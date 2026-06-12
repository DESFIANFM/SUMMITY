Aturan Bisnis
Ketua kelompok adalah pemilik SIMAKSI
Disimpan pada simaksi.ketua_user_id
Hanya 1 ketua untuk 1 SIMAKSI.
Anggota tidak mengisi checklist perlengkapan
Checklist hanya diisi oleh ketua.
Checklist dianggap mewakili seluruh rombongan.
Anggota diambil dari tabel users
Relasi many-to-many melalui tabel simaksi_anggota.
Checklist gear tersimpan per SIMAKSI
Jika membuat SIMAKSI baru, checklist baru dibuat lagi.
Histori tetap tersimpan.
Status SIMAKSI
draft
pending
approved
rejected
checkin
checkout
selesai
QUERY LENGKAP
-- =====================================================
-- MASTER GEAR WAJIB
-- =====================================================

CREATE TABLE mandatory_gear (
    id BIGSERIAL PRIMARY KEY,

    kode VARCHAR(50) NOT NULL UNIQUE,
    nama_barang VARCHAR(255) NOT NULL,

    kategori VARCHAR(50) DEFAULT 'KELOMPOK',

    aktif BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE mandatory_gear IS
'Master perlengkapan wajib pendakian';

COMMENT ON COLUMN mandatory_gear.kategori IS
'KELOMPOK atau PERSONAL';


-- =====================================================
-- HEADER SIMAKSI
-- =====================================================

CREATE TABLE simaksi (
    id BIGSERIAL PRIMARY KEY,

    kode_simaksi VARCHAR(50) UNIQUE,

    ketua_user_id BIGINT NOT NULL,

    gunung_id BIGINT NOT NULL,

    tanggal_naik DATE NOT NULL,
    tanggal_turun DATE NOT NULL,

    total_anggota INTEGER DEFAULT 1,

    ketua_kelompok BOOLEAN DEFAULT TRUE,

    status VARCHAR(20) DEFAULT 'draft',

    catatan_verifikator TEXT,

    approved_by BIGINT,
    approved_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE simaksi IS
'Header pengajuan SIMAKSI';

COMMENT ON COLUMN simaksi.ketua_user_id IS
'User yang bertindak sebagai ketua kelompok';

COMMENT ON COLUMN simaksi.total_anggota IS
'Ketua + seluruh anggota';

COMMENT ON COLUMN simaksi.status IS
'draft,pending,approved,rejected,checkin,checkout,selesai';


-- =====================================================
-- DETAIL ANGGOTA SIMAKSI
-- =====================================================

CREATE TABLE simaksi_anggota (
    id BIGSERIAL PRIMARY KEY,

    simaksi_id BIGINT NOT NULL,

    user_id BIGINT NOT NULL,

    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT uq_simaksi_anggota
        UNIQUE(simaksi_id,user_id),

    CONSTRAINT fk_simaksi_anggota_simaksi
        FOREIGN KEY(simaksi_id)
        REFERENCES simaksi(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_simaksi_anggota_user
        FOREIGN KEY(user_id)
        REFERENCES users(id)
);

COMMENT ON TABLE simaksi_anggota IS
'Daftar anggota pendakian selain ketua';


-- =====================================================
-- CHECKLIST GEAR YANG DICENTANG KETUA
-- =====================================================

CREATE TABLE simaksi_mandatory_gear (
    id BIGSERIAL PRIMARY KEY,

    simaksi_id BIGINT NOT NULL,

    mandatory_gear_id BIGINT NOT NULL,

    checked BOOLEAN DEFAULT FALSE,

    checked_by BIGINT NOT NULL,

    checked_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT uq_simaksi_gear
        UNIQUE(simaksi_id, mandatory_gear_id),

    CONSTRAINT fk_smg_simaksi
        FOREIGN KEY(simaksi_id)
        REFERENCES simaksi(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_smg_gear
        FOREIGN KEY(mandatory_gear_id)
        REFERENCES mandatory_gear(id),

    CONSTRAINT fk_smg_checked_by
        FOREIGN KEY(checked_by)
        REFERENCES users(id)
);

COMMENT ON TABLE simaksi_mandatory_gear IS
'Checklist perlengkapan yang diisi oleh ketua kelompok';

COMMENT ON COLUMN simaksi_mandatory_gear.checked_by IS
'Harus berisi user id ketua kelompok';


-- =====================================================
-- RIWAYAT STATUS SIMAKSI
-- =====================================================

CREATE TABLE simaksi_status_history (
    id BIGSERIAL PRIMARY KEY,

    simaksi_id BIGINT NOT NULL,

    status_lama VARCHAR(20),

    status_baru VARCHAR(20) NOT NULL,

    catatan TEXT,

    changed_by BIGINT,

    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT fk_history_simaksi
        FOREIGN KEY(simaksi_id)
        REFERENCES simaksi(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE simaksi_status_history IS
'Log perubahan status SIMAKSI';


-- =====================================================
-- INDEX
-- =====================================================

CREATE INDEX idx_simaksi_ketua
ON simaksi(ketua_user_id);

CREATE INDEX idx_simaksi_status
ON simaksi(status);

CREATE INDEX idx_simaksi_tanggal_naik
ON simaksi(tanggal_naik);

CREATE INDEX idx_simaksi_anggota_user
ON simaksi_anggota(user_id);

CREATE INDEX idx_smg_simaksi
ON simaksi_mandatory_gear(simaksi_id);

CREATE INDEX idx_history_simaksi
ON simaksi_status_history(simaksi_id);


-- =====================================================
-- DATA MASTER GEAR AWAL
-- =====================================================

INSERT INTO mandatory_gear
(kode, nama_barang, kategori)
VALUES

('TENDA_DOME', 'Tenda Dome (Sesuai Kapasitas)', 'KELOMPOK'),

('KOMPOR_PORTABLE', 'Kompor Portable', 'KELOMPOK'),

('NESTING', 'Nesting / Wadah Memasak', 'KELOMPOK'),

('P3K', 'P3K & Obat-obatan', 'KELOMPOK'),

('TRASH_BAG', 'Kantong Sampah / Trash Bag', 'KELOMPOK'),

('HEADLAMP', 'Headlamp', 'PERSONAL'),

('JAKET_GUNUNG', 'Jaket Gunung', 'PERSONAL'),

('SEPATU_HIKING', 'Sepatu Hiking', 'PERSONAL'),

('SLEEPING_BAG', 'Sleeping Bag', 'PERSONAL'),

('RAINCOAT', 'Jas Hujan', 'PERSONAL');
Contoh Struktur Data
Tabel simaksi
id	ketua_user_id	tanggal_naik	tanggal_turun
1	202606130001	2026-07-01	2026-07-03
Tabel simaksi_anggota
simaksi_id	user_id
1	202606130002
1	202606130003
1	202606130004
Tabel simaksi_mandatory_gear
simaksi_id	gear	checked
1	TENDA_DOME	TRUE
1	KOMPOR_PORTABLE	TRUE
1	NESTING	TRUE
1	P3K	TRUE
Saran Pengembangan untuk Summity

Karena aplikasi Anda juga memiliki fitur tracking pendakian, saya menyarankan menambahkan beberapa field di tabel simaksi:

estimasi_checkin TIMESTAMP,
estimasi_checkout TIMESTAMP,

checkin_at TIMESTAMP,
checkout_at TIMESTAMP,

last_location_lat DECIMAL(10,7),
last_location_lng DECIMAL(10,7)

Dengan begitu satu data SIMAKSI dapat langsung dipakai untuk:

Registrasi pendakian
Verifikasi petugas basecamp
Tracking perjalanan
Check-in pendakian
Check-out pendakian
Operasi SAR ketika pendaki terlambat turun

tanpa perlu membuat tabel pendakian baru. Ini biasanya lebih cocok untuk arsitektur aplikasi seperti Summity.