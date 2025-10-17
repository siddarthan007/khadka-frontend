/**
 * Development-only logger utility
 * Console statements are stripped in production builds
 */

const isDev = !import.meta.env.DEV;

export const logger = {
  /**
   * Log error messages (development only)
   */
  error: (...args: any[]) => {
    if (isDev) {
      console.error(...args);
    }
  },

  /**
   * Log warning messages (development only)
   */
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * Log info messages (development only)
   */
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log debug messages (development only)
   */
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug(...args);
    }
  }
};
