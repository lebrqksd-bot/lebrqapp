import re

# Read the entire file
with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Match all INSERT statements (they can span multiple lines)
pattern = r"(INSERT INTO \w+ \([^)]+\) VALUES)([\s\S]*?)(?=INSERT INTO|COMMIT|$)"

def fix_values(match):
    insert_header = match.group(1)
    values_section = match.group(2)
    
    result = ""
    i = 0
    while i < len(values_section):
        if values_section[i] == "'":
            # Start of a string
            result += "'"
            i += 1
            # Read until closing quote
            while i < len(values_section):
                if values_section[i] == "'":
                    # Check if it's an already-escaped quote (two in a row)
                    if i + 1 < len(values_section) and values_section[i + 1] == "'":
                        result += "''"
                        i += 2
                    else:
                        # Closing quote
                        result += "'"
                        i += 1
                        break
                else:
                    result += values_section[i]
                    i += 1
        else:
            result += values_section[i]
            i += 1
    
    return insert_header + result

# Apply the fix
content = re.sub(pattern, fix_values, content, flags=re.MULTILINE)

# Write back
with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully escaped all single quotes in INSERT VALUES sections")
