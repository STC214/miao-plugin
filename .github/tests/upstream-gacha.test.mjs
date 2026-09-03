import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync(new URL('../../apps/gacha.js', import.meta.url), 'utf8')
const implementation = fs.readFileSync(new URL('../../apps/gacha/Gacha.js', import.meta.url), 'utf8')
const profileCommon = fs.readFileSync(new URL('../../apps/profile/ProfileCommon.js', import.meta.url), 'utf8')

test('gacha help only advertises command forms registered by the app', () => {
  assert.match(app, /\^#\(星铁\)\?\(\(\?:\\d\+\\\.\)\+\\d\+\)/)
  assert.match(implementation, /#星铁x\.x卡池/)
  assert.match(implementation, /#星铁3\.0卡池/)
  assert.doesNotMatch(implementation, /\*x\.x卡池|\*3\.0卡池|\*4\.1下半卡池/)
})

test('profile refresh guidance keeps its quoted setting name balanced', () => {
  assert.match(profileCommon, /展柜需开启“显示角色详情”/)
})
