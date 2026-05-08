import { Resvg } from '@resvg/resvg-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const svgPath = path.join(__dirname, 'public', 'favicon.svg')
const svgContent = fs.readFileSync(svgPath, 'utf8')

const sizes = [16, 32, 48, 64, 128, 180, 192, 196]

sizes.forEach(function(size) {
  const resvg = new Resvg(svgContent, {
    fitTo: { mode: 'width', value: size },
  })
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()

  var outName = size <= 64 ? 'favicon-' + size + '.png' : 'apple-touch-icon-' + size + '.png'
  fs.writeFileSync(path.join(__dirname, 'public', outName), pngBuffer)
  console.log('✓ Generated: ' + outName + ' (' + pngBuffer.length + ' bytes)')
})

console.log('\nDone! Generated ' + sizes.length + ' PNG files.')
