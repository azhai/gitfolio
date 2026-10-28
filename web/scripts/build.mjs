// Copies the static site into web/dist, which is what gets embedded in the Go
// binary. There is no bundling or transpiling — this is a plain file copy.
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, watch } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const web = join(here, '..')
const dist = join(web, 'dist')
const watchMode = process.argv.includes('--watch')

// Pages are regenerated on every run, so drop the ones that no longer exist.
// Everything else is copied over in place; `make clean` removes the whole
// directory when a truly clean build is needed.
function prunePages(keep) {
  if (!existsSync(dist)) return
  for (const name of readdirSync(dist)) {
    if (!name.endsWith('.html')) continue
    if (keep.has(name)) continue
    try {
      unlinkSync(join(dist, name))
    } catch (err) {
      /* ignore */
    }
  }
}

function build() {
  mkdirSync(dist, { recursive: true })

  const pages = join(web, 'pages')
  const htmlFiles = readdirSync(pages).filter((name) => name.endsWith('.html'))
  cpSync(pages, dist, { recursive: true })

  cpSync(join(web, 'assets'), join(dist, 'assets'), { recursive: true })
  if (existsSync(join(web, 'public'))) {
    cpSync(join(web, 'public'), dist, { recursive: true })
  }
  const extras = ['landing.html', 'screenshot-1.png', 'screenshot-2.png']
  for (const extra of extras) {
    const file = join(web, extra)
    if (existsSync(file)) copyFileSync(file, join(dist, extra))
  }

  // Keep pages/*.html, anything published from public/ and landing.html.
  const keep = new Set(htmlFiles)
  keep.add('landing.html')
  const publicDir = join(web, 'public')
  if (existsSync(publicDir)) {
    for (const name of readdirSync(publicDir)) {
      if (name.endsWith('.html')) keep.add(name)
    }
  }
  prunePages(keep)

  console.log('dist ready:', dist)
}

build()

if (watchMode) {
  console.log('watching web/{pages,assets,public} ...')
  let timer = null
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      try {
        build()
      } catch (err) {
        console.error(err.message)
      }
    }, 120)
  }
  for (const dir of ['pages', 'assets', 'public']) {
    const target = join(web, dir)
    if (existsSync(target)) watch(target, { recursive: true }, schedule)
  }
  watch(web, { recursive: false }, (event, file) => {
    if (file && file.endsWith('.html')) schedule()
  })
}
