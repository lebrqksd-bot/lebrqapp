#!/usr/bin/env python3
"""
Comprehensive fix for all boolean columns with integer values in all INSERT statements
Maps each table's boolean columns and converts 0/1 to false/true
"""

import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Manually map tables to their boolean column positions (0-indexed)
# Format: table_name: [(position, column_name), ...]
boolean_column_positions = {
    'attendance': [(16, 'is_manual')],
    'bookings': [(20, 'is_admin_booking'), (28, 'broker_settled')],
    'booking_items': [(11, 'is_supplyed'), (12, 'is_supplies'), (13, 'rejection_status'), (17, 'supply_verified'), (21, 'payment_settled')],
    'booking_item_status_history': [(2, 'is_resolved')],  # Adjust if needed
    'client_notifications': [(7, 'is_read'), (8, 'is_deleted')],
    'contests': [(13, 'is_active')],
    'content_pages': [(5, 'is_published')],
    'delivery_addresses': [(11, 'is_verified')],
    'enquiries': [(9, 'auto_approve'), (10, 'is_published')],
    'gallery_items': [(10, 'is_active')],
    'items': [(8, 'is_eligible_for_space_offer'), (11, 'available')],
    'item_media': [(5, 'is_primary')],
    'payment_settlements': [(7, 'is_settled')],
    'program_participants': [(10, 'is_active'), (12, 'is_verified')],
    'spaces': [(6, 'active')],
    'staff': [(23, 'is_active')],
    'users': [(16, 'is_deleted')],
    'vendor_vehicles': [(7, 'is_active')],
}

conversion_count = 0

# Process each table
for table_name, positions in boolean_column_positions.items():
    # Find all INSERT INTO this_table blocks
    insert_pattern = rf'INSERT INTO {table_name}\s*\([^)]+\)\s*VALUES'
    
    for match in re.finditer(insert_pattern, content, re.IGNORECASE):
        values_start = match.end()
        semi_pos = content.find(';', values_start)
        
        if semi_pos == -1:
            continue
        
        values_section = content[values_start:semi_pos]
        
        # Extract all rows (each is a tuple)
        rows = re.findall(r'\(([^)]+(?:\'[^\']*\'[^)]*)*)\)', values_section)
        
        for row_text in rows:
            # Split values respecting quoted strings
            values = []
            in_quote = False
            current = ""
            
            for char in row_text:
                if char == "'" and (not current or current[-1] != '\\'):
                    in_quote = not in_quote
                    current += char
                elif char == ',' and not in_quote:
                    values.append(current.strip())
                    current = ""
                else:
                    current += char
            if current.strip():
                values.append(current.strip())
            
            # Check and convert boolean positions
            modified = False
            for pos, col_name in positions:
                if pos < len(values):
                    val = values[pos].strip()
                    if val == '0':
                        values[pos] = 'false'
                        modified = True
                        conversion_count += 1
                    elif val == '1':
                        values[pos] = 'true'
                        modified = True
                        conversion_count += 1
            
            if modified:
                old_row = '(' + row_text + ')'
                new_row = '(' + ', '.join(values) + ')'
                content = content.replace(old_row, new_row, 1)

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"✓ Converted {conversion_count} boolean values from 0/1 to false/true")
