-- Migration: Add vendor rejection and supply verification fields to booking_items table
-- Run this migration to add the new fields required for vendor workflow features

ALTER TABLE booking_items
ADD COLUMN IF NOT EXISTS rejection_status BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS rejection_note TEXT NULL,
ADD COLUMN IF NOT EXISTS rejected_at DATETIME NULL,
ADD COLUMN IF NOT EXISTS supplied_at DATETIME NULL,
ADD COLUMN IF NOT EXISTS supply_verified BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS verified_at DATETIME NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_booking_items_rejection_status ON booking_items(rejection_status);
CREATE INDEX IF NOT EXISTS idx_booking_items_supply_verified ON booking_items(supply_verified);
CREATE INDEX IF NOT EXISTS idx_booking_items_supplied_at ON booking_items(supplied_at);
CREATE INDEX IF NOT EXISTS idx_booking_items_verified_at ON booking_items(verified_at);

