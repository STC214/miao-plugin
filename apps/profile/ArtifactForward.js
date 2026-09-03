export async function makeArtifactForward (e, pages, description = '') {
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
  const candidates = [
    [globalThis.Bot, globalThis.Bot?.makeForwardMsg],
    [e?.group, e?.group?.makeForwardMsg],
    [e?.friend, e?.friend?.makeForwardMsg],
    [bot, bot.makeForwardMsg]
  ]
  const seen = new Set()
  for (const [owner, maker] of candidates) {
    if (typeof maker !== 'function' || seen.has(maker)) continue
    seen.add(maker)
    try {
      const forward = await maker.call(owner, nodes)
      if (forward) return forward
    } catch {}
  }
  return null
}
