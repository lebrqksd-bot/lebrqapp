#!/usr/bin/env python3
"""
Fix ALL boolean columns with integer values across ALL tables
Uses the comprehensive list of boolean columns found in schema
"""

import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Complete mapping of all boolean columns with their 0-indexed positions
boolean_indices = {
    'attendance': {16},
    'booking_guests': {5},
    'booking_items': {11, 12, 13, 17, 21},
    'bookings': {20, 28},
    'broker_profiles': {12},
    'client_audio_notes': {9},
    'client_messages': {8, 9, 10},
    'client_notifications': {7, 8},
    'content_pages': {5},
    'contest_entries': {15},
    'contests': {12, 14},
    'coupons': {4},
    'item_media': {5},
    'items': {8, 11},
    'notifications': {5},
    'offer_notifications': {3, 4, 5},
    'offers': {4},
    'offices': {6},
    'payroll': {25},
    'program_participants': {10, 12},
    'rack_items': {5},
    'rack_orders': {9},
    'racks': {6},
    'spaces': {6},
    'staff': {23},
    'timeslots': {6},
    'user_event_dates': {7},
    'vehicles': {13},
    'vendor_messages': {9, 10, 11},
    'vendor_notifications': {8, 9},
    'whatsapp_keyword_responses': {3},
    'whatsapp_quick_replies': {6},
}

conversion_count = 0

# Process each table
for table_name, bool_cols in boolean_indices.items():
    # Find all INSERT INTO this_table blocks
    insert_pattern = rf'INSERT INTO {table_name}\s*\([^)]+\)\s*VALUES'
    
    for match in re.finditer(insert_pattern, content, re.IGNORECASE):
        values_start = match.end()
        semi_pos = content.find(';', values_start)
        
        if semi_pos == -1:
            continue
        
        values_section = content[values_start:semi_pos]
        
        # Extract all rows (handle both single and multi-row inserts)
        # Match rows like (col1, col2, col3) or just continue if no closing paren found
        rows = re.findall(r'\(([^()]*(?:\'[^\']*\'[^()]*)*)\)', values_section)
        
        for row_text in rows:
            # Skip very short rows (likely not data rows)
            if len(row_text) < 5:
                continue
            
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
            for pos in sorted(bool_cols, reverse=True):  # Go backwards to avoid index issues
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

print(f"✓ Converted {conversion_count} boolean values from 0/1 to false/true across all tables")
