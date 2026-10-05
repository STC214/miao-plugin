import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import sizeOf from '../../tools/image-size.js'

test('image-size v2 preserves synchronous dimensions for bytes, paths and file URLs', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'miao-image-size-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const file = path.join(dir, '角色.png')
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXuoAAAAASUVORK5CYII=', 'base64')
  fs.writeFileSync(file, png)
  for (const input of [png, file, pathToFileURL(file)]) {
    const dimensions = sizeOf(input)
    assert.equal(dimensions.width, 1)
    assert.equal(dimensions.height, 1)
  }
  const source = fs.readFileSync(new URL('../../models/character/CharImg.js', import.meta.url), 'utf8')
  assert.match(source, /import sizeOf from '..\/..\/tools\/image-size.js'/)
})
