import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove all backticks
content = content.replace('`', '')

# Find all "INSERT INTO bookings" statements
# Pattern matches: INSERT INTO bookings ... ; (everything up to first semicolon)
insert_bookings_pattern = r'INSERT INTO bookings[^;]+;'
bookings_inserts = list(re.finditer(insert_bookings_pattern, content))

print(f"Found {len(bookings_inserts)} INSERT INTO bookings statements")

if len(bookings_inserts) > 1:
    print(f"Removing {len(bookings_inserts) - 1} duplicate bookings INSERT statements")
    
    # Keep the first bookings INSERT, remove all others
    first_insert_end = bookings_inserts[0].end()
    last_insert_start = bookings_inserts[-1].end()
    
    start_part = content[:first_insert_end]
    end_part = content[last_insert_start:]
    
    content = start_part + '\n' + end_part

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ File processed successfully - all duplicates removed, backticks removed")
