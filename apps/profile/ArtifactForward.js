export async function makeArtifactForward (e, pages, description = '') {
  const { nodes, candidates } = await forwardContext(e, pages, description)
  for (const [owner, maker] of uniqueCandidates(candidates)) {
    try {
      const forward = await maker.call(owner, nodes)
      if (forward) return forward
    } catch (error) {
      globalThis.logger?.debug?.(`[miao-plugin] artifact forward adapter failed: ${error.message}`)
    }
  }
  return null
}

export async function replyArtifactForward (e, pages, description = '') {
  const { nodes, candidates } = await forwardContext(e, pages, description)
  const forwardErrors = []
  for (const [owner, maker] of uniqueCandidates(candidates)) {
    try {
      const forward = await maker.call(owner, nodes)
      if (!forward) throw new Error('forward adapter returned an empty payload')
      return await replyArtifactPage(e, forward, 'forward reply')
    } catch (error) {
      forwardErrors.push(error)
      globalThis.logger?.debug?.(`[miao-plugin] artifact forward adapter/send failed: ${error.message}`)
    }
  }

  globalThis.logger?.warn?.('[miao-plugin] every artifact forward adapter failed, falling back to individual messages')
  const replies = []
  const failures = []
  let imageReplyCount = 0
  const fallbackPayloads = [
    ...(description ? [{ payload: description, kind: 'summary' }] : []),
    ...pages.map(payload => ({ payload, kind: 'image' }))
  ]
  for (let index = 0; index < fallbackPayloads.length; index++) {
    const item = fallbackPayloads[index]
    try {
      replies.push(await replyArtifactPage(e, item.payload, `fallback message ${index + 1} reply`))
      if (item.kind === 'image') imageReplyCount++
    } catch (error) {
      failures.push({ message: index + 1, kind: item.kind, error })
      globalThis.logger?.warn?.(`[miao-plugin] artifact fallback message ${index + 1} reply failed: ${error.message}`)
    }
  }

  if (imageReplyCount === 0) {
    throw new AggregateError(
      [...forwardErrors, ...failures.map(item => item.error)],
      'artifact list forward failed and no fallback image was delivered'
    )
  }
  return replies
}

export async function replyArtifactPage (e, payload, label = 'artifact reply') {
  const reply = await e.reply(payload)
  const failure = replyFailure(reply, label)
  if (failure) throw failure
  return reply
}

function replyFailure (reply, label) {
  if (reply && !reply.error) return null
  const error = new Error(`${label} returned an error result`)
  const details = Array.isArray(reply?.error)
    ? reply.error.filter(Boolean)
    : reply?.error
      ? [reply.error]
      : []
  if (details.length) error.cause = details[0]
  error.reply = reply
  return error
}

async function forwardContext (e, pages, description) {
  const bot = e?.bot || globalThis.Bot?.[e?.self_id] || globalThis.Bot || {}
  const userId = String(bot.uin || bot.self_id || e?.self_id || e?.user_id || '0')
  let nickname = String(bot.nickname || bot.name || 'miao-plugin')
  if (e?.isGroup && typeof bot.getGroupMemberInfo === 'function') {
    try {
      const info = await bot.getGroupMemberInfo(e.group_id, userId)
      nickname = info?.card || info?.nickname || nickname
    } catch {}
  }
  const messages = description ? [description, ...pages] : pages
  const nodes = messages.map(message => ({ user_id: userId, nickname, message }))
  return {
    nodes,
    candidates: [
      [globalThis.Bot, globalThis.Bot?.makeForwardMsg],
      [e?.group, e?.group?.makeForwardMsg],
      [e?.friend, e?.friend?.makeForwardMsg],
      [bot, bot.makeForwardMsg]
    ]
  }
}

function uniqueCandidates (candidates) {
  const unique = []
  for (const [owner, maker] of candidates) {
    if (typeof maker !== 'function') continue
    if (unique.some(([seenOwner, seenMaker]) => seenOwner === owner && seenMaker === maker)) continue
    unique.push([owner, maker])
  }
  return unique
}
