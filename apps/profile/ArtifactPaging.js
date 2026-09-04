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

export async function renderArtifactPageWithRetry (renderPage, attempts = 2) {
  const total = Math.max(1, Math.trunc(Number(attempts)) || 1)
  let lastError = null
  for (let attempt = 1; attempt <= total; attempt++) {
    try {
      const page = await renderPage(attempt)
      if (page) return page
      lastError = new Error(`artifact page render attempt ${attempt} returned an empty result`)
    } catch (error) {
      lastError = error
    }
  }
  const error = new Error(`artifact page render failed after ${total} attempt(s)`)
  error.cause = lastError
  throw error
}
