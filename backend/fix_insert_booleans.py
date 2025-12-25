#!/usr/bin/env python3
"""
Convert integer values (0, 1) to boolean values (false, true) in INSERT statements
This script identifies boolean columns from CREATE TABLE statements and converts
the corresponding values in INSERT statements.
"""

import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Map of table names to their boolean column names
# Extracted from the CREATE TABLE statements
boolean_columns = {
    'attendance': ['is_manual'],
    'bookings': ['is_admin_booking', 'broker_settled'],
    'booking_items': ['is_supplyed', 'is_supplies', 'rejection_status', 'supply_verified', 'payment_settled'],
    'content_pages': ['is_published'],
    'contests': ['is_active'],
    'delivery_addresses': ['is_verified'],
    'enquiries': ['auto_approve', 'is_published'],
    'gallery_items': ['is_active'],
    'item_catalog': ['is_active'],
    'payment_settlements': ['is_settled'],
    'program_participants': ['is_active', 'is_verified'],
    'spaces': ['active'],
    'staff': ['is_active'],
    'users': ['is_deleted'],
    'vendor_vehicles': ['is_active'],
}

# Process each table
for table_name, bool_cols in boolean_columns.items():
    # Find INSERT statements for this table
    pattern = rf"INSERT INTO {table_name}\s*\([^)]+\)\s*VALUES"
    
    # Find all INSERT statements for this table
    matches = list(re.finditer(pattern, content, re.IGNORECASE))
    
    if not matches:
        continue
    
    for match in matches:
        # Find the column list
        insert_start = match.start()
        paren_start = content.find('(', insert_start)
        paren_end = content.find(')', paren_start)
        
        col_list = content[paren_start+1:paren_end]
        columns = [col.strip() for col in col_list.split(',')]
        
        # Find the VALUES section
        values_start = match.end()
        values_section_start = content.find('(', values_start)
        
        # Find where this INSERT statement ends (find the semicolon)
        semi_pos = content.find(';', values_section_start)
        
        # Extract the values part
        values_text = content[values_section_start:semi_pos]
        
        # Get indices of boolean columns
        bool_indices = []
        for bool_col in bool_cols:
            if bool_col in columns:
                bool_indices.append(columns.index(bool_col))
        
        if not bool_indices:
            continue
        
        # Replace 0 and 1 with false and true for these columns
        # This is tricky - we need to handle multi-row inserts carefully
        
        # Split by rows (find patterns like ), ( that separate rows
        rows_pattern = r'\),\s*\('
        rows = re.split(rows_pattern, values_text)
        
        modified_rows = []
        for row_idx, row in enumerate(rows):
            # Clean up the row (remove leading/trailing parens and whitespace)
            row = row.strip()
            if row.startswith('('):
                row = row[1:]
            if row.endswith(')'):
                row = row[:-1]
            
            # Split values - need to handle quoted strings
            values = []
            in_quote = False
            current_val = ""
            
            for char in row:
                if char == "'" and (not current_val or current_val[-1] != '\\'):
                    in_quote = not in_quote
                    current_val += char
                elif char == ',' and not in_quote:
                    values.append(current_val.strip())
                    current_val = ""
                else:
                    current_val += char
            
            if current_val.strip():
                values.append(current_val.strip())
            
            # Replace 0 and 1 in boolean columns
            for idx in bool_indices:
                if idx < len(values):
                    if values[idx].strip() == '0':
                        values[idx] = 'false'
                    elif values[idx].strip() == '1':
                        values[idx] = 'true'
            
            modified_rows.append('(' + ', '.join(values) + ')')
        
        # Reconstruct the INSERT statement
        new_values = '),\n    ('.join([r[1:-1] for r in modified_rows])
        new_insert = content[insert_start:values_section_start] + '(' + new_values + ');'
        
        # Replace in content
        old_insert = content[insert_start:semi_pos+1]
        content = content.replace(old_insert, new_insert, 1)

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Converted integer values to boolean in INSERT statements")
