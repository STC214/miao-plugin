export const ARTIFACT_LIST_MIN = 4
export const ARTIFACT_LIST_MAX = 200
export const ARTIFACT_LIST_DEFAULT = 28

export function normalizeArtifactListLimit (value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed === 0) return ARTIFACT_LIST_DEFAULT
  return Math.min(ARTIFACT_LIST_MAX, Math.max(ARTIFACT_LIST_MIN, Math.trunc(parsed)))
}

export function artifactListPageSize (limit) {
  return limit >= 40 ? 24 : limit
}

export function artifactListDisablesUpscaling (limit) {
  return limit >= 96
}
