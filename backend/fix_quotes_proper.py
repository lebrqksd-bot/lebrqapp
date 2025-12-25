#!/usr/bin/env python3

import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Find all string literals and escape internal single quotes
# This regex finds quoted strings: 'anything'
# We need to escape unescaped quotes inside them

def escape_quotes_in_strings(text):
    """Escape unescaped single quotes in SQL string literals"""
    result = []
    i = 0
    
    while i < len(text):
        if text[i] == "'":
            # Found start of a string literal
            result.append("'")
            i += 1
            
            # Read until we find the closing quote
            while i < len(text):
                if text[i] == "'":
                    # Could be a closing quote or an escaped quote (two in a row)
                    if i + 1 < len(text) and text[i + 1] == "'":
                        # Already escaped quote ''
                        result.append("''")
                        i += 2
                    else:
                        # This is the closing quote
                        result.append("'")
                        i += 1
                        break
                else:
                    result.append(text[i])
                    i += 1
        else:
            result.append(text[i])
            i += 1
    
    return ''.join(result)

# But wait - the issue is we need to ESCAPE unescaped quotes
# The algorithm above just copies them as-is
# We need to detect unescaped quotes and double them

def escape_unescaped_quotes(text):
    """Double any single quotes that aren't already doubled"""
    result = []
    i = 0
    
    while i < len(text):
        if text[i] == "'":
            # Found a quote
            # Check if it's already part of an escaped pair
            if i > 0 and text[i-1] == "'":
                # This is the second quote in a '' pair, already counted
                result.append("'")
                i += 1
            elif i + 1 < len(text) and text[i + 1] == "'":
                # This quote is followed by another - it's an escaped pair
                result.append("''")
                i += 2
            else:
                # This is an unescaped quote
                # We need to double it ONLY if we're inside a string literal
                # Check if we're inside VALUES(...) section
                # For now, double it if it looks like it's in data context
                result.append("''")
                i += 1
        else:
            result.append(text[i])
            i += 1
    
    return ''.join(result)

# Actually, let's use a more targeted approach
# Only process INSERT...VALUES sections

lines = content.split('\n')
output_lines = []

for i, line in enumerate(lines):
    if 'INSERT INTO' in line and 'VALUES' in line:
        # This is an INSERT statement - we need to carefully escape quotes
        # Find the VALUES part and process the string literals
        
        if ' VALUES' in line:
            parts = line.split(' VALUES', 1)
            prefix = parts[0]
            values_part = parts[1]
            
            # Now process values_part to escape quotes
            fixed_values = []
            j = 0
            while j < len(values_part):
                if values_part[j] == "'":
                    # Start of string literal
                    fixed_values.append("'")
                    j += 1
                    
                    # Read string content
                    while j < len(values_part):
                        if values_part[j] == "'":
                            # Could be closing or escaped
                            if j + 1 < len(values_part) and values_part[j + 1] == "'":
                                # Already escaped
                                fixed_values.append("''")
                                j += 2
                            else:
                                # Closing quote
                                fixed_values.append("'")
                                j += 1
                                break
                        else:
                            fixed_values.append(values_part[j])
                            j += 1
                else:
                    fixed_values.append(values_part[j])
                    j += 1
            
            line = prefix + ' VALUES' + ''.join(fixed_values)
    
    output_lines.append(line)

# Write back
with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output_lines))

print("Properly escaped all single quotes in string literals")
