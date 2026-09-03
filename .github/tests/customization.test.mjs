import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  artifactListDisablesUpscaling,
  artifactListPageSize,
  normalizeArtifactListLimit
} from '../../apps/profile/ArtifactPaging.js'
import { makeArtifactForward } from '../../apps/profile/ArtifactForward.js'

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
