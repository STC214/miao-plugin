import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  artifactListDisablesUpscaling,
  artifactListPageSize,
  normalizeArtifactListLimit,
  renderArtifactPageWithRetry
} from '../../apps/profile/ArtifactPaging.js'
import { makeArtifactForward, replyArtifactForward, replyArtifactPage } from '../../apps/profile/ArtifactForward.js'

const read = file => fs.readFileSync(file, 'utf8')
const forwardSource = read('apps/profile/ArtifactForward.js')

test('artifact list keeps pagination and forward rendering', () => {
  const source = read('apps/profile/ProfileArtis.js')
  assert.match(source, /artifactListPageSize\(number\)/)
  assert.match(source, /offset \+= pageSize/)
  assert.match(source, /renderBatchId/)
  assert.match(source, /pageNumber/)
  assert.match(source, /retType:\s*['"]base64['"]/) 
  assert.match(forwardSource, /makeForwardMsg/)
  assert.match(source, /runNonSigninTask/)
  assert.match(source, /renderArtifactPageWithSigninPriority/)
  assert.match(source, /renderArtifactPageWithSigninPriority\(\(\) => \{[\s\S]*replyArtifactPage\(e, pages\[0\]\)/)
  assert.match(source, /renderArtifactPageWithSigninPriority\(\(\) => \{[\s\S]*replyArtifactForward\(e, pages/)
  assert.match(source, /renderArtifactPageWithRetry/)
  assert.match(source, /renderFailures/)
})

test('artifact list maximum remains 200', () => {
  const source = read('config/system/cfg_system.js')
  assert.match(source, /artisNumber/)
  assert.match(source, /200/)
  assert.equal(normalizeArtifactListLimit(201), 200)
})

test('large artifact lists keep supersampling disabled', () => {
  const source = read('apps/profile/ProfileArtis.js')
  assert.match(source, /artifactListDisablesUpscaling\(number\)/)
  assert.equal(artifactListDisablesUpscaling(95), false)
  assert.equal(artifactListDisablesUpscaling(96), true)
})

test('artifact pagination starts at 40 and keeps the default list in one image', () => {
  assert.equal(artifactListPageSize(28), 28)
  assert.equal(artifactListPageSize(39), 39)
  assert.equal(artifactListPageSize(40), 24)
  assert.equal(artifactListPageSize(200), 24)
})

test('artifact pages are built into one forward message with a summary node', async () => {
  const previousBot = globalThis.Bot
  let received = []
  globalThis.Bot = {
    uin: '123',
    nickname: 'bot',
    makeForwardMsg: async nodes => { received = nodes; return { type: 'forward', nodes } }
  }
  try {
    const result = await makeArtifactForward({ user_id: '456' }, ['page-1', 'page-2'], 'summary')
    assert.equal(result.type, 'forward')
    assert.deepEqual(received.map(node => node.message), ['summary', 'page-1', 'page-2'])
    assert.deepEqual(new Set(received.map(node => node.user_id)), new Set(['123']))
  } finally {
    globalThis.Bot = previousBot
  }
})

test('artifact forwarding falls through when the preferred adapter fails', async () => {
  const previousBot = globalThis.Bot
  let fallbackNodes = []
  globalThis.Bot = { makeForwardMsg: async () => { throw new Error('primary unavailable') } }
  try {
    const result = await makeArtifactForward({
      user_id: '456',
      group: {
        makeForwardMsg: async nodes => { fallbackNodes = nodes; return { type: 'group-forward' } }
      }
    }, ['page-1'], 'summary')
    assert.equal(result.type, 'group-forward')
    assert.deepEqual(fallbackNodes.map(node => node.message), ['summary', 'page-1'])
  } finally {
    globalThis.Bot = previousBot
  }
})

test('artifact forward send failure falls back to every rendered page', async () => {
  const previousBot = globalThis.Bot
  globalThis.Bot = { makeForwardMsg: async () => ({ type: 'forward' }) }
  const sent = []
  try {
    const replies = await replyArtifactForward({
      reply: async payload => {
        if (payload?.type === 'forward') throw new Error('forward send rejected')
        sent.push(payload)
        return { message_id: sent.length }
      }
    }, ['page-1', 'page-2'], 'summary')
    assert.deepEqual(sent, ['summary', 'page-1', 'page-2'])
    assert.equal(replies.length, 3)
  } finally {
    globalThis.Bot = previousBot
  }
})

test('artifact page fallback isolates one failed page and continues', async () => {
  const previousBot = globalThis.Bot
  globalThis.Bot = {}
  const attempts = []
  try {
    const replies = await replyArtifactForward({
      reply: async payload => {
        attempts.push(payload)
        if (payload === 'page-1') throw new Error('page rejected')
        return { message_id: 'second-page' }
      }
    }, ['page-1', 'page-2'], 'summary')
    assert.deepEqual(attempts, ['summary', 'page-1', 'page-2'])
    assert.equal(replies.length, 2)
  } finally {
    globalThis.Bot = previousBot
  }
})

test('empty forward send result also triggers page fallback', async () => {
  const previousBot = globalThis.Bot
  globalThis.Bot = { makeForwardMsg: async () => ({ type: 'forward' }) }
  const sent = []
  try {
    await replyArtifactForward({
      reply: async payload => {
        if (payload?.type === 'forward') return false
        sent.push(payload)
        return { message_id: sent.length }
      }
    }, ['page-1', 'page-2'], 'summary')
    assert.deepEqual(sent, ['summary', 'page-1', 'page-2'])
  } finally {
    globalThis.Bot = previousBot
  }
})

test('TRSS error result from forward send triggers page fallback', async () => {
  const previousBot = globalThis.Bot
  globalThis.Bot = { makeForwardMsg: async () => ({ type: 'forward' }) }
  const sent = []
  try {
    const replies = await replyArtifactForward({
      reply: async payload => {
        if (payload?.type === 'forward') return { error: [new Error('adapter rejected')] }
        sent.push(payload)
        return { message_id: sent.length }
      }
    }, ['page-1', 'page-2'], 'summary')
    assert.deepEqual(sent, ['summary', 'page-1', 'page-2'])
    assert.equal(replies.length, 3)
  } finally {
    globalThis.Bot = previousBot
  }
})

test('forward send failure tries the next adapter before page fallback', async () => {
  const previousBot = globalThis.Bot
  let globalBuilds = 0
  let groupBuilds = 0
  const pageSends = []
  globalThis.Bot = { makeForwardMsg: async () => { globalBuilds++; return { type: 'bad-forward' } } }
  try {
    const result = await replyArtifactForward({
      group: { makeForwardMsg: async () => { groupBuilds++; return { type: 'good-forward' } } },
      reply: async payload => {
        if (payload?.type === 'bad-forward') return { error: [new Error('unsupported forward')] }
        if (payload?.type === 'good-forward') return { message_id: 'forward-ok' }
        pageSends.push(payload)
        return { message_id: 'page' }
      }
    }, ['page-1', 'page-2'], 'summary')
    assert.equal(result.message_id, 'forward-ok')
    assert.equal(globalBuilds, 1)
    assert.equal(groupBuilds, 1)
    assert.equal(pageSends.length, 0)
  } finally {
    globalThis.Bot = previousBot
  }
})

test('empty artifact render retries once before succeeding', async () => {
  let attempts = 0
  const page = await renderArtifactPageWithRetry(async () => {
    attempts++
    return attempts === 1 ? null : 'page-image'
  })
  assert.equal(page, 'page-image')
  assert.equal(attempts, 2)
})

test('artifact render reports failure after both attempts are empty', async () => {
  let attempts = 0
  await assert.rejects(
    renderArtifactPageWithRetry(async () => { attempts++; return null }),
    error => error.message === 'artifact page render failed after 2 attempt(s)'
  )
  assert.equal(attempts, 2)
})

test('TRSS error result is rejected for a single artifact page', async () => {
  await assert.rejects(
    replyArtifactPage({ reply: async () => ({ error: [new Error('send failed')] }) }, 'page-1'),
    error => error.message === 'artifact reply returned an error result' && error.cause?.message === 'send failed'
  )
})

test('all failed page fallbacks raise an aggregate error', async () => {
  const previousBot = globalThis.Bot
  globalThis.Bot = {}
  try {
    await assert.rejects(
      replyArtifactForward({ reply: async () => ({ error: [new Error('send failed')] }) }, ['page-1', 'page-2']),
      error => error instanceof AggregateError && error.errors.length === 2
    )
  } finally {
    globalThis.Bot = previousBot
  }
})

test('successful summary never hides failure of every fallback image', async () => {
  const previousBot = globalThis.Bot
  globalThis.Bot = {}
  const attempts = []
  try {
    await assert.rejects(
      replyArtifactForward({
        reply: async payload => {
          attempts.push(payload)
          if (payload === 'summary') return { message_id: 'summary-ok' }
          return { error: [new Error('image rejected')] }
        }
      }, ['page-1', 'page-2'], 'summary'),
      error => error instanceof AggregateError && error.message.includes('no fallback image')
    )
    assert.deepEqual(attempts, ['summary', 'page-1', 'page-2'])
  } finally {
    globalThis.Bot = previousBot
  }
})
