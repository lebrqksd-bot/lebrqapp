#!/usr/bin/env python3
"""
Final comprehensive fix - convert ALL remaining 0/1 to false/true in all INSERT statements
for all tables with boolean columns
"""

import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Map of table names to their boolean column indices (0-indexed)
# These were determined from the CREATE TABLE statements
boolean_indices = {
    'attendance': {16},  # is_manual
    'bookings': {20, 28},  # is_admin_booking, broker_settled
    'booking_items': {11, 12, 13, 17, 21},  # is_supplyed, is_supplies, rejection_status, supply_verified, payment_settled
    'client_notifications': {7, 8},  # is_read, is_deleted
    'contests': {13},  # is_active
    'content_pages': {5},  # is_published
    'delivery_addresses': {11},  # is_verified
    'enquiries': {9, 10},  # auto_approve, is_published
    'gallery_items': {10},  # is_active
    'items': {8, 11},  # is_eligible_for_space_offer, available
    'item_media': {5},  # is_primary
    'payment_settlements': {7},  # is_settled
    'program_participants': {10, 12},  # is_active, is_verified
    'spaces': {6},  # active
    'staff': {23},  # is_active
    'users': {16},  # is_deleted
    'vendor_vehicles': {7},  # is_active
}

current_table = None
conversion_count = 0

for i, line in enumerate(lines, 1):
    # Check if this is an INSERT INTO line
    insert_match = re.match(r'INSERT INTO (\w+)', line)
    if insert_match:
        current_table = insert_match.group(1)
        continue
    
    # If we're in a table with boolean columns, process value rows
    if current_table and current_table in boolean_indices:
        # Check if this line looks like a value row (starts with parenthesis and number)
        if line.strip().startswith('(') and re.match(r'\(\s*\d+', line.strip()):
            # Extract values
            row_text = line.strip().rstrip(',);').lstrip('(').rstrip(')')
            
            # Split by comma, respecting quoted strings
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
            
            # Check boolean positions
            modified = False
            for idx in boolean_indices[current_table]:
                if idx < len(values):
                    val = values[idx].strip()
                    if val == '0':
                        values[idx] = 'false'
                        modified = True
                        conversion_count += 1
                    elif val == '1':
                        values[idx] = 'true'
                        modified = True
                        conversion_count += 1
            
            if modified:
                # Reconstruct the line
                new_row = '(' + ', '.join(values)
                if line.strip().endswith(';'):
                    new_row += ');'
                elif line.strip().endswith(','):
                    new_row += '),'
                else:
                    new_row += ')'
                new_row += '\n'
                lines[i-1] = new_row

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"✓ Final pass: Converted {conversion_count} remaining boolean values")
