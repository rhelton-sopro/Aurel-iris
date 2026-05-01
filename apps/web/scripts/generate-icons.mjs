import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const iconsDir = path.resolve(__dirname, '../public/icons')

const SVG_NORMAL = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#000"/>
  <text x="${size / 2}" y="${size * 0.625}" text-anchor="middle"
        font-family="sans-serif" font-size="${size * 0.47}" font-weight="700" fill="#fff">AI</text>
</svg>`

const SVG_MASKABLE = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#000"/>
  <text x="${size / 2}" y="${size * 0.6}" text-anchor="middle"
        font-family="sans-serif" font-size="${size * 0.35}" font-weight="700" fill="#fff">AI</text>
</svg>`

async function gen(svgString, outName, size) {
  await fs.mkdir(iconsDir, { recursive: true })
  const out = path.resolve(iconsDir, outName)
  await sharp(Buffer.from(svgString)).resize(size, size).png().toFile(out)
  const stat = await fs.stat(out)
  console.log(`wrote ${out} (${stat.size} bytes)`)
}

await gen(SVG_NORMAL(192), 'icon-192.png', 192)
await gen(SVG_NORMAL(512), 'icon-512.png', 512)
await gen(SVG_MASKABLE(512), 'icon-maskable.png', 512)

console.log('Done — all 3 icons generated.')
