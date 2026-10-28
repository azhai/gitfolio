// Copies the static site into web/dist, which is what gets embedded in the Go
// binary. There is no bundling or transpiling — this is a plain file copy.
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, statSync, watch } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const web = join(here, '..')
const dist = join(web, 'dist')
const watchMode = process.argv.includes('--watch')

function build() {
  rmSync(dist, { recursive: true, force: true })
  mkdirSync(dist, { recursive: true })

  // pages/*.html land at the dist root so routes stay /home, /projects, ...
  cpSync(join(web, 'pages'), dist, { recursive: true })
  cpSync(join(web, 'assets'), join(dist, 'assets'), { recursive: true })
  if (existsSync(join(web, 'public'))) {
    cpSync(join(web, 'public'), dist, { recursive: true })
  }
  for (const extra of ['landing.html', 'screenshot-1.png', 'screenshot-2.png']) {
    const file = join(web, extra)
    if (existsSync(file)) copyFileSync(file, join(dist, extra))
  }

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
