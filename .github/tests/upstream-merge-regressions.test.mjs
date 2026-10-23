import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cfgSchema } from '../../config/system/cfg_system.js'

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

async function loadGacha ({ enabled = true, result = false } = {}) {
  const rendered = []
  const requested = []
  const fixture = {
    luck: false,
    stat: { fiveNum: 1, allNum: 60, noFiveNum: 0, wai: 0, isvalidNum: 60, fiveAvg: 60 },
    fiveLog: []
  }
  const GachaData = {
    analyse: () => structuredClone(fixture),
    stat: (_qq, _uid, type, game) => { requested.push({ type, game }); return false },
    limitLog: () => {}
  }
  const source = read('apps/gacha/Gacha.js')
    .replace(/^import .*$/gm, '')
    .replace(/export default Gacha\s*$/, 'return Gacha')
  const make = new AsyncFunction('Common', 'Data', 'common', 'getTargetUid', 'GachaData', 'GachaLuck', 'GachaPool', 'Button', 'Character', 'Player', 'Weapon', source)
  const gacha = await make(
    { render: async (_template, data) => { rendered.push(data); return 'image' } },
    { importCfg: async () => ({ sysCfg: { luckCfg: { enable: true } }, diyCfg: { luckCfg: { enable: enabled } } }) },
    {}, () => '123', GachaData, { get: () => result, getImage: () => '3.jpg' }, {},
    class { gacha () { return '' } }, {}, {}, {}
  )
  gacha.getFace = () => ({})
  const event = msg => ({ msg, uid: '123', user: { qq: '456' }, reply: async () => true })
  return { gacha, rendered, requested, event }
}

test('all-statistics preserves all-pool selection while qualified all-statistics selects its pool', async () => {
  const { gacha, requested, event } = await loadGacha()
  for (const msg of ['#全部统计', '#星铁全部统计', '#角色全部统计', '#武器全部统计', '#常驻全部统计', '#集录全部统计']) {
    await gacha.stat(event(msg))
  }
  assert.deepEqual(requested, [
    { type: 'all', game: 'gs' }, { type: 'all', game: 'sr' },
    { type: 'char', game: 'gs' }, { type: 'weapon', game: 'gs' },
    { type: 'normal', game: 'gs' }, { type: 'mix', game: 'gs' }
  ])
})

test('disabled luck config never recreates a fallback rating on detail pages', async () => {
  const { gacha, rendered, event } = await loadGacha({ enabled: false })
  await gacha.detail.call({ reply: async () => true }, event('#角色记录'))
  assert.equal(Boolean(rendered[0].gacha.luck), false)
})

test('enabled luck fallback and exact model results remain available on detail pages', async () => {
  const fallback = await loadGacha()
  await fallback.gacha.detail.call({ reply: async () => true }, fallback.event('#角色记录'))
  assert.equal(fallback.rendered[0].gacha.luck.image, '3.jpg')
  const exact = await loadGacha({ result: { title: '精确评级', percent: '81.5' } })
  await exact.gacha.detail.call({ reply: async () => true }, exact.event('#角色记录'))
  assert.equal(exact.rendered[0].gacha.luck.title, '精确评级')
  assert.equal(exact.rendered[0].gacha.luck.percent, '81.5')
})

test('statistics luck image paths resolve to shipped image files', () => {
  const template = read('resources/gacha/gacha-stat.html')
  const source = read('apps/gacha/GachaLuck.js')
  const getImageSource = source.match(/getImage \(percent\) \{([\s\S]*?)\n  \},/)[1]
  const getImage = new Function('percent', getImageSource)
  const imagePath = template.match(/src="\{\{_res_path\}\}([^\"]*\{\{gacha\.luck\.image\}\}[^\"]*)"/)[1]
  for (const percent of [0, 18, 30, 42, 55, 68, 80, 92, 100]) {
    const file = imagePath.replace('{{gacha.luck.image}}', getImage(percent))
    assert.equal(fs.existsSync(new URL(`../../resources/${file}`, import.meta.url)), true, file)
  }
})

test('Guoba artifact count control preserves the local four-to-two-hundred range', () => {
  const lodash = {
    forEach: (value, iteratee) => Object.entries(value).forEach(([key, item]) => iteratee(item, key)),
    merge: (target, value) => {
      for (const [key, item] of Object.entries(value)) {
        target[key] = item && typeof item === 'object' && !Array.isArray(item)
          ? lodash.merge(target[key] || {}, item) : item
      }
      return target
    }
  }
  const source = read('guoba.support.js')
    .replace(/^import .*$/gm, '')
    .replaceAll('import.meta.url', JSON.stringify(new URL('../../guoba.support.js', import.meta.url).href))
    .replace('export function supportGuoba', 'function supportGuoba')
  const support = new Function('path', 'lodash', 'fileURLToPath', 'Cfg', 'Version', 'cfgSchema', `${source}\nreturn supportGuoba`)(
    path, lodash, fileURLToPath, {}, { isMiao: false }, cfgSchema
  )
  const control = support().configInfo.schemas.find(item => item.field === 'artisNumber')
  assert.equal(control.componentProps.min, 4)
  assert.equal(control.componentProps.max, 200)
  assert.equal(cfgSchema.profile.cfg.artisNumber.input(200), 200)
})
