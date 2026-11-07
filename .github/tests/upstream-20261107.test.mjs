import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import score from '../../resources/meta-gs/character/奥黛塔/artis.js'
import { usefulAttr } from '../../resources/meta-gs/artifact/artis-mark.js'

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
const executable = (file, name) => read(file).replace(/^import .*$/gm, '').replace(new RegExp(`export default ${name}\\s*$`), `return ${name}`)
const lodash = {
  forEach: (value, fn) => Object.entries(value || {}).forEach(([key, item]) => fn(item, key)),
  isPlainObject: value => value?.constructor === Object,
  isFunction: value => typeof value === 'function',
  isEmpty: value => Object.keys(value || {}).length === 0
}
class Base {
  get isSr () { return this.game === 'sr' }
}

function fixture (type, name) {
  // Use the production refinement/static helpers, not approximations in the test.
  const index = read('resources/meta-gs/weapon/index.js')
  const helpers = new Function(index.slice(index.indexOf('const step ='), index.indexOf('for (let type in weaponType)')) + '\nreturn { step, attr }')()
  const factory = new Function(read(`resources/meta-gs/weapon/${type}/calc.js`).replace('export default function', 'return function'))()
  const weaponBuffs = factory(helpers.step, helpers.attr)
  const Meta = { getMeta: () => ({ weaponBuffs }) }
  const Weapon = new Function('Base', 'Meta', 'lodash', executable('models/Weapon.js', 'Weapon'))(Base, Meta, lodash)
  const weapon = Object.assign(Object.create(Weapon.prototype), { game: 'gs', name, id: -1, _detail: {} })
  weapon.calcAttr = () => ({ atkBase: 0, attr: { key: 'atkPct', value: 0 } })
  Weapon.get = () => weapon
  const Attr = new Function('Base', 'Meta', 'Weapon', 'lodash', executable('models/attr/Attr.js', 'Attr'))(Base, Meta, Weapon, lodash)
  const DmgBuffs = new Function('lodash', 'Weapon', executable('models/dmg/DmgBuffs.js', 'DmgBuffs'))(lodash, Weapon)
  return { Attr, weapon, DmgBuffs }
}

test('new mastery bonus uses the base region once and preserves existing character bonuses', () => {
  const { Attr } = fixture('catalyst', '漩流颂歌')
  for (const [id, expected] of [[10000136, 100], [10000122, 100], [10000119, 200], [10000005, 15], [10000007, 15], [10000002, 0]]) {
    const calls = []
    const attr = new Attr({ game: 'gs', level: 1, promote: 0, char: { id, detail: {}, getCalcRule: () => ({ buffs: [] }) } })
    attr.addAttr = (...args) => calls.push(args)
    attr.setCharAttr()
    assert.deepEqual(calls.filter(([key]) => key === 'mastery'), expected ? [['mastery', expected, true]] : [])
  }
})

test('Genshin mastery additions never leak into Star Rail characters with the same numeric id', () => {
  const { Attr } = fixture('catalyst', '漩流颂歌')
  const calls = []
  const attr = new Attr({ game: 'sr', level: 1, promote: 0, char: { id: 10000136, detail: {}, getLvAttr: () => ({ mastery: 7 }) } })
  attr.addAttr = (...args) => calls.push(args)
  attr.setCharAttr()
  assert.deepEqual(calls, [['mastery', 7, true]])
})

test('both character indexes use the corrected burst id without modifying normal attack or skill', () => {
  const index = JSON.parse(read('resources/meta-gs/character/data.json'))['10000136']
  const detail = JSON.parse(read('resources/meta-gs/character/米提亚/data.json'))
  for (const item of [index, detail]) assert.deepEqual(item.talentId, { 11361: 'a', 11362: 'e', 11364: 'q' })
})

test('artifact scoring changes only at C4 and never mutates the shared scoring defaults', () => {
  const before = structuredClone(usefulAttr['奥黛塔'])
  for (const cons of [0, 1, 2, 3, 4, 5, 6, 0, 2]) {
    const result = score({ cons, def: (attrs, title = []) => ({ attrs, title }) })
    assert.deepEqual(result.attrs, cons >= 4 ? { ...before, recharge: 50 } : before)
    assert.deepEqual(result.title, cons >= 4 ? ['高命'] : [])
  }
  assert.deepEqual(usefulAttr['奥黛塔'], before)
})

for (const [type, name, key, base, conditional] of [
  ['catalyst', '漩流颂歌', 'heal', 4, ['hpPct', 21]],
  ['claymore', '「究极霸王超级魔剑」', 'atkPct', 12, ['atkPct', 12]]
]) {
  test(`${name}: real profile calculator includes the static bonus exactly once at R1–R5`, () => {
    const { Attr, weapon } = fixture(type, name)
    for (const affix of [1, 2, 3, 4, 5]) {
      const calls = []
      const attr = new Attr({ game: 'gs', char: {}, weapon: { name, affix, level: 90, promote: 6 } })
      attr.addAttr = (key, value) => calls.push([key, value])
      attr.setWeaponAttr()
      const expected = base * (1 + (affix - 1) / 4)
      assert.equal(calls.filter(([field]) => field === key).reduce((sum, [, value]) => sum + value, 0), expected)
      assert.deepEqual(weapon.getWeaponAffixBuffs(affix, true), [{ isStatic: true, data: { [key]: expected } }])
      if (key !== conditional[0]) assert.equal(calls.some(([field]) => field === conditional[0]), false)
    }
  })

  test(`${name}: damage buffs exclude static bonuses and retain conditional bonuses at R1–R5`, () => {
    const { DmgBuffs } = fixture(type, name)
    for (const affix of [1, 5, 2, 4, 3, 1]) {
      const buffs = DmgBuffs.getWeaponBuffs({ name, affix })
      assert.equal(buffs.length, 1)
      assert.equal(Boolean(buffs[0].isStatic), false)
      assert.deepEqual(Object.keys(buffs[0].data), [conditional[0]])
      assert.equal(buffs[0].data[conditional[0]]({ refine: affix - 1 }), conditional[1] * (1 + (affix - 1) / 4))
      assert.equal(buffs[0].title.split(name).length - 1, 1)
    }
  })
}
