import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import gs from '../../resources/meta-gs/artifact/calc.js'
import sr from '../../resources/meta-sr/artifact/calc.js'

test('Gilded Dreams defaults and explicit team composition retain correct bonuses', () => {
  const rules = gs['饰金之梦'][4].data
  for (const [count, different] of [[undefined, 2], [1, 1], [2, 2], [3, 3]]) {
    const context = { params: { mArtisDiffCount: count } }
    assert.equal(rules.mArtisDiffCount(context), different)
    assert.equal(rules.sameCount(context), 3 - different)
    assert.equal(rules.mastery(context), 50 * different)
    assert.equal(rules.atkPct(context), 14 * (3 - different))
  }
})

test('Heretic two-piece adds critical damage instead of critical chance', () => {
  assert.deepEqual(sr['贪噬禁果的异端'][2].data, { cdmg: 16 })
})

test('Subspace entry-speed boundary and duplicate-team-buff guard are preserved', () => {
  const [staticBonus, conditional] = sr['亚空异容所'][2]
  assert.deepEqual(staticBonus.data, { speedPct: 6 })
  for (const [speed, duplicate, expected] of [[144.99, false, false], [145, false, true], [145, true, false]]) {
    assert.equal(conditional.check({ attr: { speed: 999 }, calc: n => n, params: { entrySpeed: speed, subspaceBuffAlreadyApplied: duplicate } }), expected)
  }
  assert.deepEqual(conditional.data, { stance: 18 })
})

test('Divine joy threshold is an entry check, not an extra damage multiplier', () => {
  const [staticBonus, conditional] = sr['神的瞬息欢愉'][2]
  assert.deepEqual(staticBonus.data, { speedPct: 6 })
  assert.equal(conditional.check({ attr: { joy: 40 }, calc: n => n, params: {} }), true)
  assert.equal(conditional.check({ attr: { joy: 99 }, calc: n => n, params: { entryJoy: 39 } }), false)
  assert.equal(conditional.data, undefined)
})

test('Fork keeps its existing Moment dependency and image-size compatibility adapter', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url)))
  assert.equal(pkg.dependencies.moment, '^2.31.0')
  assert.match(fs.readFileSync(new URL('../../models/character/CharImg.js', import.meta.url), 'utf8'), /import sizeOf from '..\/..\/tools\/image-size.js'/)
})
