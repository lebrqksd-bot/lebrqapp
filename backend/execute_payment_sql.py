#!/usr/bin/env python3
"""
Script to execute payment table creation SQL
"""

import requests
import json

def execute_sql_via_api():
    """Execute SQL via the existing API"""
    try:
        # Read the SQL file
        with open('add_payment_tables.sql', 'r') as f:
            sql_content = f.read()
        
        # Split into individual statements
        statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
        
        # Execute each statement via API (if there's a SQL execution endpoint)
        # For now, let's just print the statements
        print("SQL statements to execute:")
        for i, stmt in enumerate(statements, 1):
            print(f"\n{i}. {stmt}")
        
        print("\n✅ SQL file read successfully!")
        print("Please execute these SQL statements in your MySQL database.")
        print("You can use MySQL Workbench, phpMyAdmin, or command line MySQL client.")
        
    except Exception as e:
        print(f"❌ Error reading SQL file: {e}")

if __name__ == "__main__":
    execute_sql_via_api()
