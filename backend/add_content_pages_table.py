#!/usr/bin/env python3
"""
Add content_pages table for managing website content
"""

import asyncio
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

# Add the parent directory to Python path
sys.path.append(str(Path(__file__).parent))

from app.core import settings

async def add_content_pages_table():
    """Add content_pages table to store website content"""
    
    # Get database URL and convert to sync version
    db_url = settings.DATABASE_URL
    print(f"Using DATABASE_URL: {db_url}")
    
    is_mysql = "+asyncmy" in db_url or "+pymysql" in db_url or db_url.startswith("mysql")
    is_sqlite = "+aiosqlite" in db_url or db_url.startswith("sqlite")
    
    # Convert async URL to sync URL
    if "+asyncmy" in db_url:
        sync_url = db_url.replace("+asyncmy", "+pymysql")
    elif "+aiosqlite" in db_url:
        sync_url = db_url.replace("+aiosqlite", "")
    else:
        sync_url = db_url
    
    print(f"Connecting with sync URL: {sync_url}")
    
    # SQL to create the content_pages table (MySQL vs SQLite syntax)
    if is_mysql:
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS content_pages (
            id INT PRIMARY KEY AUTO_INCREMENT,
            page_name VARCHAR(50) UNIQUE NOT NULL,
            title VARCHAR(200) NOT NULL,
            content TEXT NOT NULL,
            meta_description TEXT,
            is_published BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
        """
        
        # MySQL uses different syntax for INSERT OR REPLACE
        insert_default_content = """
        INSERT INTO content_pages (page_name, title, content, meta_description) VALUES 
        ('about', 'About Us', 
         '<h2>Welcome to Lebrq</h2><p>Your premier destination for fitness and wellness programs. We offer a wide range of classes including yoga, zumba, and live events designed to help you achieve your health and fitness goals.</p><p>Our state-of-the-art facilities and experienced instructors provide a supportive environment for all fitness levels.</p>', 
         'Learn more about Lebrq - your fitness and wellness destination'),
        
        ('faq', 'Frequently Asked Questions',
         '<h3>How do I book a class?</h3><p>You can book classes through our mobile app or website. Simply browse available sessions and click "Book Now".</p><h3>Can I cancel my booking?</h3><p>Yes, you can cancel bookings up to 2 hours before the scheduled time.</p><h3>What should I bring to class?</h3><p>Please bring a water bottle, towel, and comfortable workout attire. Yoga mats are provided.</p>',
         'Find answers to common questions about our services'),
         
        ('privacy-policy', 'Privacy Policy',
         '<h2>Privacy Policy</h2><p>This Privacy Policy describes how your personal information is collected, used, and shared when you use our application.</p><h3>Information We Collect</h3><p>We collect information you provide directly to us, such as when you create an account, make a booking, or contact us.</p><h3>How We Use Your Information</h3><p>We use the information we collect to provide, maintain, and improve our services.</p>',
         'Our privacy policy explains how we handle your personal information'),
         
        ('terms-of-service', 'Terms of Service',
         '<h2>Terms of Service</h2><p>Please read these Terms of Service carefully before using our application.</p><h3>Acceptance of Terms</h3><p>By accessing and using this application, you accept and agree to be bound by the terms and provision of this agreement.</p><h3>Use License</h3><p>Permission is granted to temporarily use our application for personal, non-commercial transitory viewing only.</p>',
         'Terms and conditions for using our services'),
         
        ('refund-policy', 'Refund Policy',
         '<h2>Refund Policy</h2><p>We want you to be satisfied with our services. Here are our refund guidelines:</p><h3>Class Cancellations</h3><p>• Full refund if cancelled 24+ hours before class<br>• 50% refund if cancelled 2-24 hours before class<br>• No refund for cancellations less than 2 hours before class</p><h3>Medical Emergencies</h3><p>Full refunds are available for documented medical emergencies with proper medical certificate.</p><h3>Processing Time</h3><p>Refunds are processed within 5-7 business days to your original payment method.</p>',
         'Our refund and cancellation policy details')
        ON DUPLICATE KEY UPDATE 
        title = VALUES(title),
        content = VALUES(content),
        meta_description = VALUES(meta_description),
        updated_at = CURRENT_TIMESTAMP;
        """
    else:
        # SQLite syntax
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS content_pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            page_name VARCHAR(50) UNIQUE NOT NULL,
            title VARCHAR(200) NOT NULL,
            content TEXT NOT NULL,
            meta_description TEXT,
            is_published BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        
        insert_default_content = """
        INSERT OR REPLACE INTO content_pages (page_name, title, content, meta_description) VALUES 
        ('about', 'About Us', 
         '<h2>Welcome to Lebrq</h2><p>Your premier destination for fitness and wellness programs. We offer a wide range of classes including yoga, zumba, and live events designed to help you achieve your health and fitness goals.</p><p>Our state-of-the-art facilities and experienced instructors provide a supportive environment for all fitness levels.</p>', 
         'Learn more about Lebrq - your fitness and wellness destination'),
        
        ('faq', 'Frequently Asked Questions',
         '<h3>How do I book a class?</h3><p>You can book classes through our mobile app or website. Simply browse available sessions and click "Book Now".</p><h3>Can I cancel my booking?</h3><p>Yes, you can cancel bookings up to 2 hours before the scheduled time.</p><h3>What should I bring to class?</h3><p>Please bring a water bottle, towel, and comfortable workout attire. Yoga mats are provided.</p>',
         'Find answers to common questions about our services'),
         
        ('privacy-policy', 'Privacy Policy',
         '<h2>Privacy Policy</h2><p>This Privacy Policy describes how your personal information is collected, used, and shared when you use our application.</p><h3>Information We Collect</h3><p>We collect information you provide directly to us, such as when you create an account, make a booking, or contact us.</p><h3>How We Use Your Information</h3><p>We use the information we collect to provide, maintain, and improve our services.</p>',
         'Our privacy policy explains how we handle your personal information'),
         
        ('terms-of-service', 'Terms of Service',
         '<h2>Terms of Service</h2><p>Please read these Terms of Service carefully before using our application.</p><h3>Acceptance of Terms</h3><p>By accessing and using this application, you accept and agree to be bound by the terms and provision of this agreement.</p><h3>Use License</h3><p>Permission is granted to temporarily use our application for personal, non-commercial transitory viewing only.</p>',
         'Terms and conditions for using our services'),
         
        ('refund-policy', 'Refund Policy',
         '<h2>Refund Policy</h2><p>We want you to be satisfied with our services. Here are our refund guidelines:</p><h3>Class Cancellations</h3><p>• Full refund if cancelled 24+ hours before class<br>• 50% refund if cancelled 2-24 hours before class<br>• No refund for cancellations less than 2 hours before class</p><h3>Medical Emergencies</h3><p>Full refunds are available for documented medical emergencies with proper medical certificate.</p><h3>Processing Time</h3><p>Refunds are processed within 5-7 business days to your original payment method.</p>',
         'Our refund and cancellation policy details');
        """
    
    try:
        # Create sync engine
        engine = create_engine(sync_url, echo=True)
        
        with engine.begin() as conn:
            print("Creating content_pages table...")
            conn.execute(text(create_table_sql))
            
            print("Inserting default content...")
            conn.execute(text(insert_default_content))
        
        print("✅ Successfully created content_pages table with default content!")
        
    except Exception as e:
        print(f"❌ Error creating content_pages table: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(add_content_pages_table())