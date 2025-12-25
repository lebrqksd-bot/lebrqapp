How to import the Lebrq schema into SQLyog

1) Open SQLyog and create a new connection to your MySQL server (host: 127.0.0.1, port: 3306, user: root, password: root).

2) Create the database (if not created already):
   - Right-click the connection -> Create Database -> name it `lebrq`.

3) Select the `lebrq` database in the left sidebar.

4) Import the SQL file:
   - File -> Run SQL Script... -> select `lebrq_schema.sql` (path: `backend/lebrq_schema.sql` in this project).
   - Click Execute. The script will create tables if they don't already exist.

5) Refresh the schema tree in SQLyog. You should see these tables:
   - users, vendor_profiles, venues, spaces, timeslots, items, bookings, payments, booking_items, booking_events

6) Verify a table's structure:
   - Right-click a table -> Create Table -> or Table -> Object -> View Create Table (depending on SQLyog version) to see the full CREATE statement.

Notes / Troubleshooting
- If you don't have SQLyog, you can run the SQL file from the command line (Windows PowerShell):

  mysql -u root -p lebrq < .\lebrq_schema.sql

- If the server is running with the app and file-watch is enabled, running local helper scripts that touch Python files may trigger a server reload. To avoid that, run `show_schema.py` in a separate terminal window while keeping the server running, or stop the server temporarily.

- The DB credentials used in this project are host `127.0.0.1`, user `root`, password `root`, port `3306`. If you changed them, update the `lebrq_schema.sql` import accordingly or use SQLyog connection settings.
