import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = file => fs.readFileSync(file, 'utf8')

test('artifact list keeps pagination and forward rendering', () => {
  const source = read('apps/profile/ProfileArtis.js')
  assert.match(source, /offset \+= 24/)
  assert.match(source, /retType:\s*['"]base64['"]/) 
  assert.match(source, /makeForwardMsg/)
})

test('artifact list maximum remains 200', () => {
  const source = read('config/system/cfg_system.js')
  assert.match(source, /artisNumber/)
  assert.match(source, /200/)
})

test('large artifact lists keep supersampling disabled', () => {
  const source = read('apps/profile/ProfileArtis.js')
  assert.match(source, /noScale:\s*number\s*>=\s*96/)
})
