-- Database Indexes for Memory Optimization
-- Run this script to add indexes that improve query performance and reduce memory usage

-- Bookings table indexes
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_status ON bookings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_datetime ON bookings(start_datetime);
CREATE INDEX IF NOT EXISTS idx_bookings_end_datetime ON bookings(end_datetime);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_type ON bookings(booking_type);
CREATE INDEX IF NOT EXISTS idx_bookings_space_id ON bookings(space_id);
CREATE INDEX IF NOT EXISTS idx_bookings_venue_id ON bookings(venue_id);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);

-- Booking items indexes
CREATE INDEX IF NOT EXISTS idx_booking_items_booking_id ON booking_items(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_items_item_id ON booking_items(item_id);
CREATE INDEX IF NOT EXISTS idx_booking_items_vendor_id ON booking_items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_booking_items_event_date ON booking_items(event_date);
CREATE INDEX IF NOT EXISTS idx_booking_items_booking_status ON booking_items(booking_status);

-- Rack orders indexes
CREATE INDEX IF NOT EXISTS idx_rack_orders_user_id ON rack_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_rack_orders_user_status ON rack_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_rack_orders_status ON rack_orders(status);
CREATE INDEX IF NOT EXISTS idx_rack_orders_created_at ON rack_orders(created_at);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- Users indexes (if not already exist)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Items indexes
CREATE INDEX IF NOT EXISTS idx_items_vendor_id ON items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);

-- Spaces indexes
CREATE INDEX IF NOT EXISTS idx_spaces_venue_id ON spaces(venue_id);
CREATE INDEX IF NOT EXISTS idx_spaces_active ON spaces(active);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_bookings_user_date_status ON bookings(user_id, start_datetime, status);
CREATE INDEX IF NOT EXISTS idx_booking_items_booking_vendor ON booking_items(booking_id, vendor_id);

-- Analyze tables to update statistics (helps query optimizer)
ANALYZE TABLE bookings;
ANALYZE TABLE booking_items;
ANALYZE TABLE rack_orders;
ANALYZE TABLE payments;


