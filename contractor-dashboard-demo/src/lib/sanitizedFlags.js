// src/lib/sanitizedFlags.js
// Helper to convert raw backend fraud flags into contractor‑friendly plain‑language messages.
// The backend stores technical details (e.g., pHash distance, CLIP cosine, GPS radius).
// For the submitter role we hide those internals and expose only actionable explanations.

// Example mapping – in production this can be driven by a config or DB table.
const FLAG_SANITIZATION_MAP = {
  // code: user‑facing message (no thresholds shown)
  LOCATION_MISMATCH: "Location does not match the claimed district",
  DUPLICATE_PHOTO: "This photo appears to have been submitted before",
  AMOUNT_MISMATCH: "Invoice amount differs from the claimed amount",
  LOW_QUALITY: "Photo quality is insufficient for verification",
  // fallback generic message
  DEFAULT:
    "The submission raised a verification flag. Please review the details.",
};

/**
 * Sanitizes an array of flag objects for the submitter UI.
 * @param {Array} flags Raw flag objects from the backend. Each flag should contain at least:
 *   - code: internal flag identifier (string)
 *   - severity: LOW / MEDIUM / HIGH
 *   - message: technical description (ignored for submitters)
 * @returns {Array} Array of sanitized flag objects with user‑friendly message.
 */
export function sanitizeFlagsForSubmitter(flags) {
  if (!Array.isArray(flags)) return [];
  return flags.map((flag) => {
    const friendly =
      FLAG_SANITIZATION_MAP[flag.code] || FLAG_SANITIZATION_MAP["DEFAULT"];
    return {
      ...flag,
      // keep severity for badge colour, replace technical message with friendly one
      message: friendly,
    };
  });
}

export default sanitizeFlagsForSubmitter;
