/*
* 角色圣遗物评分详情
*
* */
import lodash from 'lodash'
import { Cfg, Common, Meta } from '#miao'
import { getTargetUid, profileHelp, getProfileRefresh } from './ProfileCommon.js'
import { Artifact, Button, Character, Player } from '#miao.models'
import ArtisMarkCfg from '../../models/artis/ArtisMarkCfg.js'
import {
  artifactListDisablesUpscaling,
  artifactListPageSize,
  normalizeArtifactListLimit
} from './ArtifactPaging.js'
import { makeArtifactForward } from './ArtifactForward.js'

/*
* 角色圣遗物面板
* */
export async function profileArtis (e) {
  let { uid, avatar } = e
  let profile = e._profile || await getProfileRefresh(e, avatar)
  if (!profile) {
    return true
  }
  if (!profile.hasArtis()) {
    e.reply('未能获得圣遗物详情，请重新获取面板信息后查看')
    return true
  }
  let char = profile.char
  let { game } = char
  let charCfg = ArtisMarkCfg.getCfg(profile)

  let { attrMap } = Meta.getMeta(game, 'arti')

  let artisDetail = profile.getArtisMark()
  let artisKeyTitle = Artifact.getArtisKeyTitle(game)

  // 渲染图像
  return e.reply([await Common.render('character/artis-mark', {
    uid,
    elem: char.elem,
    splash: profile.costumeSplash,
    imgs: profile.imgs,
    data: profile,
    costume: profile.costume ? '2' : '',
    artisDetail,
    artisKeyTitle,
    attrMap,
    charCfg,
    game,
    changeProfile: e._profileMsg
  }, { e, scale: 1.6 / 1.1, retType: 'base64' }), new Button(e).profile(char, uid)])
}

/*
* 圣遗物列表
* */
export async function profileArtisList (e) {
  let game = /星铁|遗器/.test(e.msg) ? 'sr' : 'gs'
  e.isSr = game === 'sr'

  let uid = await getTargetUid(e)
  if (!uid) {
    return true
  }

  let artis = []
  let player = Player.create(uid, game)
  player.forEachAvatar((avatar) => {
    let profile = avatar.getProfile()
    if (!profile) {
      return true
    }
    let name = profile.name
    let char = Character.get(name, game)
    if (!profile.hasData || !profile.hasArtis()) {
      return true
    }
    let profileArtis = profile.getArtisMark()
    lodash.forEach(profileArtis.artis, (arti, idx) => {
      arti.charWeight = profileArtis.charWeight
      arti.idx = idx
      arti.avatar = name
      arti.side = char.side
      artis.push(arti)
    })
  })

  if (artis.length === 0) {
    let artisName = game === 'gs' ? '圣遗物' : '遗器'
    e.reply(`请先获取角色面板数据后再查看${artisName}列表...`)
    await profileHelp(e)
    return true
  }

  // 过滤主词条命中唯一有效属性且副词条全废的圣遗物/遗器
  artis = filterSingleEffArtis(artis)
  if (artis.length === 0) {
    e.reply('当前圣遗物列表在有效词条过滤后为空，请更新面板数据后重试')
    return true
  }

  artis = lodash.sortBy(artis, '_mark')
  artis = artis.reverse()
  const number = normalizeArtifactListLimit(Cfg.get('artisNumber', 28))
  artis = artis.slice(0, number)
  let artisKeyTitle = Artifact.getArtisKeyTitle(game)

  // Values below 40 keep the original single-image behavior. From 40 onward,
  // render sequentially in pages of 24 items.
  const pageSize = artifactListPageSize(number)
  const noScale = artifactListDisablesUpscaling(number)
  const renderBatchId = `${uid}-${Date.now()}`
  const pages = []
  for (let offset = 0; offset < artis.length; offset += pageSize) {
    const pageArtis = artis.slice(offset, offset + pageSize)
    const pageNumber = Math.floor(offset / pageSize) + 1
    // Disable extra upscaling for requests of 96 or more items.
    const scale = noScale ? 1 : 1.4
    pages.push(await renderArtifactPageWithSigninPriority(() => Common.render('character/artis-list', {
      save_id: `${renderBatchId}-${pageNumber}`,
      uid,
      artis: pageArtis,
      artisKeyTitle
    }, { e, scale, noScale, retType: 'base64' })))
  }

  await waitForLotusSigninPriority()
  if (pages.length === 1) return pages[0]
  const listName = game === 'sr' ? '遗器列表' : '圣遗物列表'
  const forward = await makeArtifactForward(e, pages, `${listName}（共 ${pages.length} 页）`)
  return e.reply(forward || pages)
}

/**
 * 过滤主词条命中唯一有效属性且副词条全废的圣遗物/遗器
 * @param {Array} artis 圣遗物列表（每项含 main.key, attrs[].key, charWeight, idx）
 * @returns {Array} 过滤后的列表
 */
async function waitForLotusSigninPriority () {
  const coordinator = globalThis.__LOTUS_SIGNIN_COORDINATOR__
  if (typeof coordinator?.waitForSignin === 'function') await coordinator.waitForSignin()
}

export async function renderArtifactPageWithSigninPriority (renderPage) {
  const coordinator = globalThis.__LOTUS_SIGNIN_COORDINATOR__
  if (typeof coordinator?.runNonSigninTask === 'function') {
    return coordinator.runNonSigninTask(renderPage)
  }
  await waitForLotusSigninPriority()
  return renderPage()
}

export async function setArtisNumber (e) {
  if (!e.isMaster) {
    e.reply('仅主人可以设置圣遗物列表数量')
    return true
  }
  const match = /^#\u5723\u9057\u7269\u5217\u8868\u6570\u91cf\s*(\d{1,3})$/.exec(e.msg)
  const value = Number(match?.[1])
  if (!Number.isInteger(value) || value < 4 || value > 200) {
    e.reply('圣遗物列表数量必须在 4 到 200 之间')
    return true
  }
  Cfg.set('artisNumber', value)
  e.reply(`圣遗物列表数量已设置为 ${value}`)
  return true
}

function filterSingleEffArtis (artis) {
  return artis.filter(arti => {
    // 仅过滤主词条非固定圣遗物/遗器
    if (arti.idx != null && arti.idx < 2) return true

    let keys = Object.keys(arti.charWeight || {}).filter(k => arti.charWeight[k] > 0)
    if (keys.length === 0) return true

    let count = 0
    let mainEff = arti.main && keys.includes(arti.main.key)
    if (mainEff) count++
    if (arti.attrs) {
      arti.attrs.forEach(attr => {
        if (keys.includes(attr.key)) count++
      })
    }

    if (mainEff && count === 1) return false
    return true
  })
}
