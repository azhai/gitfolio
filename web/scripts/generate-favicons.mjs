import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

var __dirname = dirname(fileURLToPath(import.meta.url))
var svgPath = join(__dirname, '..', 'public', 'favicon.svg')
var outDir = join(__dirname, '..', 'public')

mkdirSync(outDir, { recursive: true })

var svg = readFileSync(svgPath)

var sizes = [
  { name: 'favicon-16.png', size: 16 },
  { name: 'favicon-32.png', size: 32 },
  { name: 'favicon-48.png', size: 48 },
  { name: 'apple-touch-icon-128.png', size: 128 },
  { name: 'apple-touch-icon-180.png', size: 180 },
  { name: 'apple-touch-icon-192.png', size: 192 },
]

for (var item of sizes) {
  var resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: item.size },
  })
  var pngData = resvg.render()
  var pngBuffer = pngData.asPng()
  var outPath = join(outDir, item.name)
  writeFileSync(outPath, pngBuffer)
  console.log(`Generated ${item.name} (${item.size}x${item.size})`)
}

console.log('All favicon files generated!')
