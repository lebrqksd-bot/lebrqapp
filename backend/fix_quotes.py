import re

# Read the file
with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Process line by line for efficiency
output_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    
    # Check if this is an INSERT INTO line
    if line.strip().startswith('INSERT INTO'):
        # Collect the full INSERT statement (may span multiple lines)
        insert_lines = [line]
        i += 1
        # Keep adding lines until we find one ending with ;
        while i < len(lines) and not lines[i].rstrip().endswith(';'):
            insert_lines.append(lines[i])
            i += 1
        if i < len(lines):
            insert_lines.append(lines[i])
            i += 1
        
        # Join all lines
        full_insert = ''.join(insert_lines)
        
        # Find the VALUES part
        if ' VALUES' in full_insert:
            parts = full_insert.split(' VALUES', 1)
            header = parts[0]
            values_part = parts[1]
            
            # Escape single quotes in the VALUES part: ' -> ''
            # But we need to be careful not to double-escape already doubled quotes
            # Use a negative lookbehind/lookahead approach
            fixed_values = re.sub(r"(?<!')\'(?!')", "''", values_part)
            
            fixed_insert = header + ' VALUES' + fixed_values
            output_lines.append(fixed_insert)
        else:
            output_lines.append(full_insert)
    else:
        output_lines.append(line)
        i += 1

# Write back
with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.writelines(output_lines)

print("Successfully escaped all unescaped single quotes in INSERT statements")
