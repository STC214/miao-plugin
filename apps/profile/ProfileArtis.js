/*
* 角色圣遗物评分详情
*
* */
import lodash from 'lodash'
import { Cfg, Common, Meta } from '#miao'
import { getTargetUid, profileHelp, getProfileRefresh } from './ProfileCommon.js'
import { Artifact, Button, Character, Player } from '#miao.models'
import ArtisMarkCfg from '../../models/artis/ArtisMarkCfg.js'
import makemsg from '../../../../lib/common/common.js'

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

  artis = lodash.sortBy(artis, '_mark')
  artis = artis.reverse()
  const number = Math.min(200, Math.max(4, Number(Cfg.get('artisNumber', 28)) || 28))
  artis = artis.slice(0, number)
  let artisKeyTitle = Artifact.getArtisKeyTitle(game)

  // Render sequentially in pages of 24 items.
  const pages = []
  for (let offset = 0; offset < artis.length; offset += 24) {
    const pageArtis = artis.slice(offset, offset + 24)
    // Disable extra upscaling for requests of 96 or more items.
    const scale = number >= 96 ? 1 : 1.4
    pages.push(await Common.render('character/artis-list', {
      save_id: uid,
      uid,
      artis: pageArtis,
      artisKeyTitle
    }, { e, scale, noScale: number >= 96 }))
  }

  if (pages.length === 1) return pages[0]
  return e.reply(makemsg.makeForwardMsg(e, pages, `Artifact list (${pages.length} pages)`))
}

/**
 * 过滤主词条命中唯一有效属性且副词条全废的圣遗物/遗器
 * @param {Array} artis 圣遗物列表（每项含 main.key, attrs[].key, charWeight, idx）
 * @returns {Array} 过滤后的列表
 */
export async function setArtisNumber (e) {
  if (!e.isMaster) {
    e.reply('Only the master can set the artifact list count')
    return true
  }
  const match = /^#\u5723\u9057\u7269\u5217\u8868\u6570\u91cf\s*(\d{1,3})$/.exec(e.msg)
  const value = Number(match?.[1])
  if (!Number.isInteger(value) || value < 4 || value > 200) {
    e.reply('Artifact list count must be between 4 and 200')
    return true
  }
  Cfg.set('artisNumber', value)
  e.reply(`Artifact list count set to ${value}`)
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
