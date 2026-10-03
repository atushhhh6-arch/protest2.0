PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS placements (
  slot_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  base_cents INTEGER NOT NULL CHECK(base_cents > 0),
  current_booking_id TEXT,
  current_sponsor_id TEXT,
  current_amount_cents INTEGER,
  current_logo_asset_id TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  print_locked INTEGER NOT NULL DEFAULT 0 CHECK(print_locked IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sponsors (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('draft','active','inactive','rejected')),
  owner_name TEXT NOT NULL DEFAULT '',
  brand_name TEXT NOT NULL,
  description TEXT NOT NULL,
  website TEXT NOT NULL DEFAULT '',
  x_handle TEXT NOT NULL DEFAULT '',
  identity_email TEXT NOT NULL DEFAULT '',
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL REFERENCES placements(slot_id),
  sponsor_id TEXT REFERENCES sponsors(id),
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  expected_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','checkout_created','finalizing','paid','failed','expired','cancelled','conflict_refund_required','refunded')),
  hold_expires_at TEXT NOT NULL,
  manage_token_hash TEXT NOT NULL UNIQUE,
  owner_name TEXT NOT NULL DEFAULT '',
  brand_name TEXT NOT NULL,
  description TEXT NOT NULL,
  website TEXT NOT NULL DEFAULT '',
  x_handle TEXT NOT NULL DEFAULT '',
  identity_email TEXT NOT NULL DEFAULT '',
  logo_asset_id TEXT,
  terms_version TEXT NOT NULL,
  payment_provider TEXT NOT NULL DEFAULT '',
  provider_checkout_id TEXT NOT NULL DEFAULT '',
  provider_payment_id TEXT NOT NULL DEFAULT '',
  provider_customer_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS spot_holds (
  slot_id TEXT PRIMARY KEY REFERENCES placements(slot_id),
  booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 0 CHECK(is_public IN (0,1)),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_events (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  booking_id TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','processed','failed')),
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(provider,event_id)
);

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  reason TEXT NOT NULL CHECK(reason IN ('takeover','spot_conflict','cancellation','artwork_rejected','duplicate_payment','other')),
  status TEXT NOT NULL CHECK(status IN ('pending','processing','succeeded','failed')),
  source_booking_id TEXT NOT NULL DEFAULT '',
  provider_refund_id TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS refunds_one_reason_per_booking ON refunds(booking_id,reason);
CREATE INDEX IF NOT EXISTS bookings_slot_status ON bookings(slot_id,status);
CREATE INDEX IF NOT EXISTS bookings_provider_payment ON bookings(payment_provider,provider_payment_id);
CREATE INDEX IF NOT EXISTS refunds_status ON refunds(status,created_at);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK(event_type IN ('placement','takeover','refund','cancellation')),
  slot_id TEXT NOT NULL REFERENCES placements(slot_id),
  sponsor_id TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  previous_booking_id TEXT,
  previous_brand_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS activity_created ON activity(created_at DESC);

CREATE TABLE IF NOT EXISTS view_events (
  id TEXT PRIMARY KEY,
  sponsor_id TEXT NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  viewer_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES
  ('bookings_open','0',CURRENT_TIMESTAMP),
  ('print_lock_at','',CURRENT_TIMESTAMP),
  ('terms_version','2026-10-03',CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO placements(slot_id,name,location,base_cents) VALUES
  ('F01','Left Chest','Front · Chest',20000),
  ('F02','Right Chest','Front · Chest',20000),
  ('F03','Centre Rectangle','Front · Stomach',35000),
  ('F04','Lower Left','Front · Below the stomach',15000),
  ('F05','Lower Right','Front · Below the stomach',15000),
  ('F06','Left Sleeve','Front view · Shoulder / sleeve',10000),
  ('F07','Right Sleeve','Front view · Shoulder / sleeve',10000),
  ('B01','Upper Back Left','Back · Upper left',20000),
  ('B02','Upper Back Right','Back · Upper right',20000),
  ('B03','Back Rectangle','Back · Centre',35000),
  ('B04','Lower Back Left','Back · Lower left',15000),
  ('B05','Lower Back Right','Back · Lower right',15000);
