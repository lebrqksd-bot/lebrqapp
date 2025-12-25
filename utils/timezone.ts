/**
 * Timezone utility functions for the frontend
 */

/**
 * Format a UTC datetime string to local timezone
 * @param utcDateTimeString - ISO datetime string from backend (e.g., "2025-10-23T12:10:25.069020+00:00")
 * @param options - Formatting options
 * @returns Formatted datetime string in local timezone
 */
export function formatDateTime(
  utcDateTimeString: string | null | undefined,
  options: {
    includeTime?: boolean;
    includeSeconds?: boolean;
    includeTimezone?: boolean;
  } = {}
): string {
  if (!utcDateTimeString) {
    return 'Never';
  }

  const {
    includeTime = true,
    includeSeconds = false,
    includeTimezone = true
  } = options;

  try {
    const date = new Date(utcDateTimeString);
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    const formatOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };

    if (includeTime) {
      formatOptions.hour = '2-digit';
      formatOptions.minute = '2-digit';
      formatOptions.hour12 = false; // Use 24-hour format
      
      if (includeSeconds) {
        formatOptions.second = '2-digit';
      }
    }

    if (includeTimezone) {
      formatOptions.timeZoneName = 'short';
    }

    return new Intl.DateTimeFormat('en-US', formatOptions).format(date);
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return 'Invalid Date';
  }
}

/**
 * Get relative time (e.g., "2 hours ago", "yesterday")
 * @param utcDateTimeString - ISO datetime string from backend
 * @returns Relative time string
 */
export function getRelativeTime(utcDateTimeString: string | null | undefined): string {
  if (!utcDateTimeString) {
    return 'Never';
  }

  try {
    const date = new Date(utcDateTimeString);
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days === 1 ? '' : 's'} ago`;
    } else {
      return formatDateTime(utcDateTimeString, { includeTime: false });
    }
  } catch (error) {
    console.error('Error getting relative time:', error);
    return 'Invalid Date';
  }
}

/**
 * Get user's timezone
 * @returns User's timezone string
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Check if a datetime is today
 * @param utcDateTimeString - ISO datetime string from backend
 * @returns True if the date is today
 */
export function isToday(utcDateTimeString: string | null | undefined): boolean {
  if (!utcDateTimeString) {
    return false;
  }

  try {
    const date = new Date(utcDateTimeString);
    const today = new Date();
    
    return date.toDateString() === today.toDateString();
  } catch (error) {
    return false;
  }
}

/**
 * Check if a datetime is yesterday
 * @param utcDateTimeString - ISO datetime string from backend
 * @returns True if the date is yesterday
 */
export function isYesterday(utcDateTimeString: string | null | undefined): boolean {
  if (!utcDateTimeString) {
    return false;
  }

  try {
    const date = new Date(utcDateTimeString);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    return date.toDateString() === yesterday.toDateString();
  } catch (error) {
    return false;
  }
}
