import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = relative => fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8')
const dmgAttr = read('models/dmg/DmgAttr.js')
const dmgCalc = read('models/dmg/DmgCalc.js')
const artifact = read('resources/meta-gs/artifact/calc.js')
const catalyst = read('resources/meta-gs/weapon/catalyst/calc.js')
const sword = read('resources/meta-gs/weapon/sword/calc.js')

test('stellar vortex is initialized for fresh and cached attributes and accepted by buff accumulation', () => {
  assert.match(dmgAttr, /ret\.stellarVortex = 0/)
  assert.match(dmgAttr, /ret\.stellarVortex = ret\.stellarVortex \* 1 \|\| 0/)
  const reactionKeys = dmgAttr.split('\n').find(line => line.includes("'stellarConduct'") && line.includes("'stellarSwirl'")) || ''
  assert.match(reactionKeys, /'stellarVortex'/)
})

test('stellar vortex uses the stellar reaction damage branch', () => {
  assert.match(dmgCalc, /case 'stellarConduct':\s*case 'stellarSwirl':\s*case 'stellarVortex':/)
})

test('every newly configured stellar vortex bonus is disclosed in its calculation title', () => {
  assert.match(artifact, /星辉冰旋伤害提升20%/)
  assert.match(artifact, /星辉冰旋伤害提升\[stellarVortex\]%/)
  for (const weapon of [catalyst, sword]) {
    assert.match(weapon, /星扩散伤害提升\[stellarSwirl\]%/)
    assert.match(weapon, /星辉冰旋伤害提升\[stellarVortex\]%/)
  }
})

test('generic stellar-reaction artifact bonuses cover conduct, swirl and vortex equally', () => {
  const buff = loadArtifact()['炉火融炼之心'][4]
  assert.deepEqual(buff.data, {
    atkPct: 12,
    stellarConduct: 50,
    stellarSwirl: 50,
    stellarVortex: 50
  })
  assert.equal(buff.check({ element: '雷' }), true)
  assert.equal(buff.check({ element: '风' }), true)
  assert.equal(buff.check({ element: '冰' }), true)
  for (const key of ['stellarConduct', 'stellarSwirl', 'stellarVortex']) {
    assert.match(buff.title, new RegExp(`\\[${key}\\]`))
  }
})

test('cached attributes execute the actual buff accumulator and preserve stellar vortex values', () => {
  const DmgAttr = loadDmgAttr()
  const originalAttr = DmgAttr.getAttr({
    attr: {},
    weapon: { affix: 1 },
    char: { weaponTypeName: '', elem: '冰' },
    game: 'gs'
  })
  delete originalAttr.stellarVortex
  const result = DmgAttr.calcAttr({
    originalAttr,
    buffs: [{ title: '星辉冰旋提升[stellarVortex]%', data: { stellarVortex: 40 } }],
    meta: { characterName: 'test', element: '冰' },
    artis: {},
    game: 'gs'
  })
  assert.equal(result.attr.stellarVortex, 40)
  assert.deepEqual(result.msg, ['星辉冰旋提升40.0%'])
})

test('actual damage calculator applies stellar vortex bonus through the stellar branch', () => {
  const DmgCalc = loadDmgCalc()
  const item = () => ({ base: 0, plus: 0, pct: 0, inc: 0 })
  const attr = stellarVortex => ({
    atk: item(), dmg: item(), phy: item(), coloringDmg: item(),
    cdmg: item(), cpct: item(), enemydmg: item(), mastery: item(),
    enemy: { def: 0, ignore: 0 }, multi: 0, fyplus: 0, fypct: 0,
    elevated: 0, kx: 0, fykx: 0, stellarVortex
  })
  const data = stellarVortex => ({
    ds: { calc: value => typeof value === 'object' ? (value.base || 0) + (value.plus || 0) : Number(value) || 0 },
    attr: attr(stellarVortex), level: 90, enemyLv: 90, game: 'gs'
  })
  const args = {
    pctNum: 0, talent: false, ele: 'stellarVortex', basicNum: 1000,
    mode: 'basic', dynamicData: {}, params: {}
  }
  const baseline = DmgCalc.calcRet(args, data(0)).avg
  const modified = DmgCalc.calcRet(args, data(40)).avg
  assert.equal(Number.isFinite(baseline) && Number.isFinite(modified), true)
  assert.equal(modified / baseline, 1.4)
})

function loadDmgAttr () {
  const source = executableSource(dmgAttr, 'DmgAttr')
  const lodash = {
    merge: (_target, value) => structuredClone(value),
    forEach: (value, iteratee) => Object.entries(value || {}).forEach(([key, item]) => iteratee(item, key)),
    isUndefined: value => value === undefined,
    isFunction: value => typeof value === 'function'
  }
  const Format = { elemName: value => value, comma: value => Number(value).toFixed(1) }
  const Meta = { getMeta: () => ({ attrMap: {} }) }
  const AttrItem = { create: value => value }
  const DmgMastery = { getMultiple: () => 0, getBasePct: () => 1 }
  return new Function('lodash', 'DmgMastery', 'Format', 'Meta', 'AttrItem', source)(lodash, DmgMastery, Format, Meta, AttrItem)
}

function loadDmgCalc () {
  const source = executableSource(dmgCalc, 'DmgCalc')
  const lodash = { forEach: (value, iteratee) => Array.from(value || []).forEach(iteratee) }
  const levels = Array(101).fill(1)
  const DmgMastery = { getBasePct: () => 1, getMultiple: () => 0 }
  return new Function('eleBaseDmg', 'erTitle', 'breakBaseDmg', 'cryBaseDmg', 'elationBaseDmg', 'DmgMastery', 'lodash', source)(
    levels, {}, levels, levels, levels, DmgMastery, lodash
  )
}

function loadArtifact () {
  return new Function(executableSource(artifact, 'buffs'))()
}

function executableSource (source, exportedName) {
  return source
    .replace(/^\uFEFF/, '')
    .replace(/^import .*$/gm, '')
    .replace(new RegExp(`export default ${exportedName}\\s*$`), `return ${exportedName}`)
}
