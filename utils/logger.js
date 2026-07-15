/**
 * Application logger utility — morgan-compatible stream.
 * @module utils/logger
 */

/**
 * Morgan stream that writes trimmed request log lines to console.log.
 * @type {{ write: (message: string) => void }}
 */
export const stream = {
  /**
   * @param {string} message
   * @returns {void}
   */
  write(message) {
    console.log(message.trim());
  },
};
