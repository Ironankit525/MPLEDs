// Contractor-facing explanations. Raw detector thresholds and matching-image
// paths stay hidden, but the submitter must still see what is wrong and what
// evidence needs to be provided next.

const FLAG_MESSAGES = {
  EXACT_DUPLICATE: 'This photo has already been submitted for another work.',
  PERCEPTUAL_DUPLICATE: 'This photo closely matches an image submitted for another work.',
  PERCEPTUAL_SUSPICIOUS: 'This photo resembles an earlier submission and needs verification.',
  SEMANTIC_DUPLICATE: 'This appears to show a site already submitted for another work.',
  SEMANTIC_SUSPICIOUS: 'This resembles evidence submitted for another work.',
  GEOMETRIC_DUPLICATE: 'Image features match evidence submitted for another work.',
  CROSS_DISTRICT_MATCH: 'The matching photo is associated with a different district.',
  CROSS_MP_MATCH: 'The matching photo is associated with a different constituency.',
  CONTENT_MISMATCH: 'The photo does not clearly show the declared type of work.',
  CONTENT_MISMATCH_SEVERE: 'The photo does not show the declared type of work.',
  FAMOUS_LANDMARK_SUSPECTED:
    'This appears to be a famous landmark or stock/travel image, not evidence from the claimed project site.',
  NOT_PROJECT_WORK_EVIDENCE:
    'This does not appear to be a contractor progress or completion photo from the claimed project.',
  WORK_EVIDENCE_UNCLEAR:
    'The subject may match, but the photo does not clearly document recent work at a local project site.',
  EXIF_STRIPPED:
    'Original camera metadata is missing, so capture date and device provenance cannot be confirmed.',
  GPS_MISSING:
    'No usable image or device location was received. The claimed project location cannot be verified.',
  GPS_DISTRICT_MISMATCH: 'The captured location is outside the claimed project district.',
  PHOTO_PREDATES_SANCTION: 'The photo was captured before the work was sanctioned.',
  PHOTO_FUTURE_DATED: 'The photo contains an invalid future capture date.',
  SOFTWARE_EDITED: 'The file reports that it was processed with image-editing software.',
  IMAGE_TAMPERED: 'The image contains regions that may have been altered.',
  SCREENSHOT_DETECTED: 'This appears to be a screenshot rather than an original camera photo.',
  SCREEN_CAPTURE_SUSPECTED: 'The ML check indicates this is a screen capture rather than a camera photo.',
  PHOTO_OF_PHOTO: 'This appears to be a photo of another photo or display.',
  RECEIPT_AMOUNT_MISMATCH: 'The amount read from the receipt does not match the claimed amount.',
  RECEIPT_DATE_BEFORE_SANCTION: 'The date read from the receipt is before the sanction date.',
}

function percent(value) {
  return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : null
}

function safeEvidenceSummary(flag) {
  const evidence = flag?.evidence || {}

  if (['FAMOUS_LANDMARK_SUSPECTED', 'NOT_PROJECT_WORK_EVIDENCE', 'WORK_EVIDENCE_UNCLEAR'].includes(flag.code)) {
    const projectConfidence = percent(evidence.valid_project_evidence_probability)
    return projectConfidence ? `Project-evidence confidence: ${projectConfidence}` : null
  }
  if (['CONTENT_MISMATCH', 'CONTENT_MISMATCH_SEVERE'].includes(flag.code)) {
    const match = percent(evidence.match_confidence)
    return match ? `Declared-work match: ${match}` : null
  }
  if (flag.code === 'SCREEN_CAPTURE_SUSPECTED') {
    const probability = percent(evidence.screen_probability)
    return probability ? `Screen-capture confidence: ${probability}` : null
  }
  if (flag.code === 'GPS_DISTRICT_MISMATCH' && typeof evidence.distance_km === 'number') {
    return `Captured approximately ${evidence.distance_km.toFixed(1)} km from the claimed district centre.`
  }
  if (evidence.matched_work_id) return `Matches work ${evidence.matched_work_id}.`
  return null
}

export function sanitizeFlagsForSubmitter(flags) {
  if (!Array.isArray(flags)) return []
  return flags.map((flag) => ({
    ...flag,
    message: FLAG_MESSAGES[flag.code] || flag.message || 'Manual verification is required for this submission.',
    evidence_summary: safeEvidenceSummary(flag),
    evidence: undefined,
  }))
}

export default sanitizeFlagsForSubmitter
