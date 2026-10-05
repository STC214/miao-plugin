import fs from 'node:fs'
import { imageSize } from 'image-size'

// image-size v2 accepts bytes only; retain the fork's synchronous file-path contract.
export default function sizeOf (input) {
  return imageSize(typeof input === 'string' || input instanceof URL ? fs.readFileSync(input) : input)
}
