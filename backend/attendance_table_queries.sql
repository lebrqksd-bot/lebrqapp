-- ============================================
-- ATTENDANCE TABLE SQL QUERIES
-- ============================================

-- 1. CREATE TABLE STATEMENT
-- ============================================
CREATE TABLE IF NOT EXISTS `attendance` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `staff_id` INT NOT NULL,
    `attendance_date` DATE NOT NULL,
    
    -- Check-in/Check-out
    `check_in_time` DATETIME NULL,
    `check_out_time` DATETIME NULL,
    `total_hours` FLOAT NULL,
    `overtime_hours` FLOAT DEFAULT 0.0,
    
    -- GPS Coordinates
    `check_in_latitude` FLOAT NULL,
    `check_in_longitude` FLOAT NULL,
    `check_out_latitude` FLOAT NULL,
    `check_out_longitude` FLOAT NULL,
    
    -- Device Info
    `check_in_device_type` VARCHAR(50) NULL,
    `check_in_ip_address` VARCHAR(45) NULL,
    `check_out_device_type` VARCHAR(50) NULL,
    `check_out_ip_address` VARCHAR(45) NULL,
    
    -- Status
    `status` VARCHAR(20) NOT NULL DEFAULT 'present',
    `is_manual` BOOLEAN DEFAULT FALSE,
    `manual_correction_note` TEXT NULL,
    `corrected_by_user_id` INT NULL,
    `corrected_at` DATETIME NULL,
    
    -- Timestamps
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`corrected_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    
    -- Indexes
    INDEX `idx_staff_id` (`staff_id`),
    INDEX `idx_attendance_date` (`attendance_date`),
    INDEX `idx_staff_date` (`staff_id`, `attendance_date`),
    UNIQUE KEY `unique_staff_date` (`staff_id`, `attendance_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 2. USEFUL SELECT QUERIES
-- ============================================

-- Get all attendance records
SELECT * FROM `attendance` ORDER BY `attendance_date` DESC, `staff_id`;

-- Get attendance for a specific staff member
SELECT * FROM `attendance` 
WHERE `staff_id` = 1 
ORDER BY `attendance_date` DESC;

-- Get today's attendance for all staff
SELECT a.*, s.name as staff_name, s.employee_code
FROM `attendance` a
JOIN `staff` s ON a.staff_id = s.id
WHERE a.attendance_date = CURDATE()
ORDER BY a.check_in_time DESC;

-- Get attendance for a date range
SELECT a.*, s.name as staff_name, s.employee_code, s.designation
FROM `attendance` a
JOIN `staff` s ON a.staff_id = s.id
WHERE a.attendance_date BETWEEN '2024-01-01' AND '2024-01-31'
ORDER BY a.attendance_date DESC, s.name;

-- Get attendance by status
SELECT a.*, s.name as staff_name
FROM `attendance` a
JOIN `staff` s ON a.staff_id = s.id
WHERE a.status = 'present'
ORDER BY a.attendance_date DESC;

-- Get staff with check-in but no check-out (still working)
SELECT a.*, s.name as staff_name, s.employee_code
FROM `attendance` a
JOIN `staff` s ON a.staff_id = s.id
WHERE a.check_in_time IS NOT NULL 
  AND a.check_out_time IS NULL
  AND a.attendance_date = CURDATE();

-- Get monthly attendance summary for a staff
SELECT 
    staff_id,
    COUNT(*) as total_days,
    SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
    SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
    SUM(CASE WHEN status = 'half_day' THEN 1 ELSE 0 END) as half_days,
    SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave_days,
    SUM(total_hours) as total_working_hours,
    SUM(overtime_hours) as total_overtime_hours
FROM `attendance`
WHERE staff_id = 1 
  AND attendance_date BETWEEN '2024-01-01' AND '2024-01-31'
GROUP BY staff_id;

-- Get attendance with staff details (full join)
SELECT 
    a.id,
    a.attendance_date,
    a.check_in_time,
    a.check_out_time,
    a.total_hours,
    a.overtime_hours,
    a.status,
    a.is_manual,
    s.name as staff_name,
    s.employee_code,
    s.designation,
    s.department
FROM `attendance` a
JOIN `staff` s ON a.staff_id = s.id
ORDER BY a.attendance_date DESC, s.name;

-- Get manually corrected attendance
SELECT a.*, s.name as staff_name, u.email as corrected_by_email
FROM `attendance` a
JOIN `staff` s ON a.staff_id = s.id
LEFT JOIN `users` u ON a.corrected_by_user_id = u.id
WHERE a.is_manual = TRUE
ORDER BY a.corrected_at DESC;

-- Get attendance with GPS location data
SELECT 
    a.id,
    a.attendance_date,
    a.check_in_time,
    a.check_in_latitude,
    a.check_in_longitude,
    a.check_in_device_type,
    s.name as staff_name,
    s.employee_code
FROM `attendance` a
JOIN `staff` s ON a.staff_id = s.id
WHERE a.check_in_latitude IS NOT NULL 
  AND a.check_in_longitude IS NOT NULL
ORDER BY a.attendance_date DESC;

-- Get attendance statistics for dashboard
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT staff_id) as total_staff,
    SUM(CASE WHEN attendance_date = CURDATE() AND status = 'present' THEN 1 ELSE 0 END) as present_today,
    SUM(CASE WHEN attendance_date = CURDATE() AND status = 'absent' THEN 1 ELSE 0 END) as absent_today,
    SUM(CASE WHEN attendance_date = CURDATE() AND check_in_time IS NOT NULL AND check_out_time IS NULL THEN 1 ELSE 0 END) as currently_working
FROM `attendance`;


-- ============================================
-- 3. UPDATE QUERIES
-- ============================================

-- Update check-out time
UPDATE `attendance`
SET 
    check_out_time = NOW(),
    total_hours = TIMESTAMPDIFF(HOUR, check_in_time, NOW()),
    updated_at = NOW()
WHERE id = 1;

-- Mark attendance as manually corrected
UPDATE `attendance`
SET 
    is_manual = TRUE,
    manual_correction_note = 'Admin correction',
    corrected_by_user_id = 1,
    corrected_at = NOW(),
    updated_at = NOW()
WHERE id = 1;

-- Update attendance status
UPDATE `attendance`
SET 
    status = 'absent',
    updated_at = NOW()
WHERE id = 1;


-- ============================================
-- 4. INSERT QUERIES
-- ============================================

-- Insert new attendance record
INSERT INTO `attendance` (
    staff_id,
    attendance_date,
    check_in_time,
    check_in_latitude,
    check_in_longitude,
    check_in_device_type,
    check_in_ip_address,
    status
) VALUES (
    1,
    CURDATE(),
    NOW(),
    12.345678,
    77.654321,
    'mobile',
    '192.168.1.1',
    'present'
);

-- Insert attendance with check-in and check-out
INSERT INTO `attendance` (
    staff_id,
    attendance_date,
    check_in_time,
    check_out_time,
    total_hours,
    overtime_hours,
    status
) VALUES (
    1,
    '2024-01-15',
    '2024-01-15 09:00:00',
    '2024-01-15 18:00:00',
    8.0,
    1.5,
    'present'
);


-- ============================================
-- 5. DELETE QUERIES
-- ============================================

-- Delete attendance record
DELETE FROM `attendance` WHERE id = 1;

-- Delete all attendance for a specific date
DELETE FROM `attendance` WHERE attendance_date = '2024-01-15';

-- Delete all manual corrections
DELETE FROM `attendance` WHERE is_manual = TRUE;


-- ============================================
-- 6. ANALYTICS QUERIES
-- ============================================

-- Average working hours per staff for a month
SELECT 
    s.name,
    s.employee_code,
    AVG(a.total_hours) as avg_working_hours,
    SUM(a.total_hours) as total_hours,
    COUNT(*) as days_worked
FROM `attendance` a
JOIN `staff` s ON a.staff_id = s.id
WHERE a.attendance_date BETWEEN '2024-01-01' AND '2024-01-31'
  AND a.status = 'present'
GROUP BY s.id, s.name, s.employee_code
ORDER BY avg_working_hours DESC;

-- Late arrivals (check-in after 9:30 AM)
SELECT 
    a.attendance_date,
    a.check_in_time,
    s.name as staff_name,
    s.employee_code,
    TIMESTAMPDIFF(MINUTE, DATE_FORMAT(a.check_in_time, '%Y-%m-%d 09:30:00'), a.check_in_time) as minutes_late
FROM `attendance` a
JOIN `staff` s ON a.staff_id = s.id
WHERE DATE(a.check_in_time) = CURDATE()
  AND TIME(a.check_in_time) > '09:30:00'
ORDER BY a.check_in_time;

-- Overtime summary
SELECT 
    s.name,
    s.employee_code,
    SUM(a.overtime_hours) as total_overtime,
    COUNT(CASE WHEN a.overtime_hours > 0 THEN 1 END) as overtime_days
FROM `attendance` a
JOIN `staff` s ON a.staff_id = s.id
WHERE a.attendance_date BETWEEN '2024-01-01' AND '2024-01-31'
GROUP BY s.id, s.name, s.employee_code
HAVING total_overtime > 0
ORDER BY total_overtime DESC;

