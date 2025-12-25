"""
Create Transportation Vehicles Table

This script creates the comprehensive vehicles table with all required fields
for the enhanced transportation system.
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'lebrq.db')

def create_vehicles_table():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create vehicles table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_name VARCHAR(100) NOT NULL,
            vehicle_capacity INTEGER NOT NULL,
            base_fare DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            per_km_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            minimum_km INTEGER DEFAULT 0,
            vehicle_image TEXT,
            extra_charges DECIMAL(10, 2) DEFAULT 0.00,
            waiting_charges_per_hour DECIMAL(10, 2) DEFAULT 0.00,
            night_charges DECIMAL(10, 2) DEFAULT 0.00,
            peak_hour_multiplier DECIMAL(3, 2) DEFAULT 1.00,
            description TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create vehicle_bookings table (tracks transport booking details)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vehicle_bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_id INTEGER NOT NULL,
            vehicle_id INTEGER NOT NULL,
            number_of_guests INTEGER NOT NULL,
            guest_contact_number VARCHAR(15) NOT NULL,
            pickup_location TEXT NOT NULL,
            drop_location TEXT,
            estimated_distance_km DECIMAL(10, 2),
            base_fare DECIMAL(10, 2) NOT NULL,
            per_km_rate DECIMAL(10, 2) NOT NULL,
            calculated_cost DECIMAL(10, 2) NOT NULL,
            extra_charges DECIMAL(10, 2) DEFAULT 0.00,
            total_amount DECIMAL(10, 2) NOT NULL,
            booking_status VARCHAR(50) DEFAULT 'pending',
            driver_assigned VARCHAR(100),
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booking_id) REFERENCES bookings(id),
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
        )
    ''')
    
    # Create indexes for performance
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_vehicles_capacity 
        ON vehicles(vehicle_capacity)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_vehicles_active 
        ON vehicles(is_active)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_vehicle_bookings_booking 
        ON vehicle_bookings(booking_id)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_vehicle_bookings_vehicle 
        ON vehicle_bookings(vehicle_id)
    ''')
    
    conn.commit()
    print("✅ Vehicles tables created successfully")
    
    # Insert sample vehicles
    sample_vehicles = [
        ('Sedan (4 Seater)', 4, 500.00, 15.00, 10, None, 100.00, 50.00, 200.00, 1.20, 'Comfortable sedan for small groups', 1),
        ('SUV (7 Seater)', 7, 800.00, 20.00, 10, None, 150.00, 75.00, 300.00, 1.25, 'Spacious SUV for medium groups', 1),
        ('Mini Van (12 Seater)', 12, 1200.00, 25.00, 15, None, 200.00, 100.00, 400.00, 1.30, 'Mini van for larger groups', 1),
        ('Bus (30 Seater)', 30, 2500.00, 35.00, 20, None, 500.00, 150.00, 800.00, 1.40, 'Full-size bus for events', 1),
        ('Luxury Sedan (4 Seater)', 4, 1000.00, 25.00, 10, None, 200.00, 100.00, 300.00, 1.50, 'Premium sedan with luxury amenities', 1),
    ]
    
    cursor.executemany('''
        INSERT INTO vehicles (
            vehicle_name, vehicle_capacity, base_fare, per_km_rate, minimum_km,
            vehicle_image, extra_charges, waiting_charges_per_hour, night_charges,
            peak_hour_multiplier, description, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', sample_vehicles)
    
    conn.commit()
    print("✅ Sample vehicles inserted")
    
    # Display created vehicles
    cursor.execute('SELECT id, vehicle_name, vehicle_capacity, base_fare, per_km_rate FROM vehicles')
    vehicles = cursor.fetchall()
    print("\n📋 Created Vehicles:")
    for v in vehicles:
        print(f"  ID: {v[0]}, Name: {v[1]}, Capacity: {v[2]}, Base: ₹{v[3]}, Per KM: ₹{v[4]}")
    
    conn.close()

if __name__ == "__main__":
    create_vehicles_table()

