#!/usr/bin/env node
/**
 * Static server for tools/launch-tracker.html — always port 3456.
 * Not part of the Next.js app (no auth middleware).
 */
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const PORT = 3456
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const toolsDir = path.resolve(__dirname, '../tools')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

function safePath(urlPath) {
  const normalized = urlPath.split('?')[0]
  const rel = normalized === '/' ? '/launch-tracker.html' : normalized
  const file = path.resolve(toolsDir, `.${rel}`)
  if (!file.startsWith(toolsDir + path.sep) && file !== toolsDir) return null
  return file
}

const server = http.createServer((req, res) => {
  const file = safePath(req.url ?? '/')
  if (!file) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'text/plain' })
    res.end(data)
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log('')
  console.log('  Launch tracker (static — no sign-in)')
  console.log(`  → http://127.0.0.1:${PORT}/launch-tracker.html`)
  console.log('')
  console.log('  If you see a Sign In page, you opened the wrong URL.')
  console.log('  Do NOT use localhost:3000 (that is the Next.js app).')
  console.log('')
})

server.on('error', async (err) => {
  if (err.code === 'EADDRINUSE') {
    const url = `http://127.0.0.1:${PORT}/launch-tracker.html`
    try {
      const res = await fetch(url)
      const body = await res.text()
      if (body.includes('B&amp;O-READY Launch Tracker') || body.includes('launch-tracker-app.jsx')) {
        console.log('')
        console.log('  Launch tracker is already running.')
        console.log(`  → ${url}`)
        console.log('')
        console.log('  Open that URL in your browser (no need to start again).')
        console.log('  To restart: lsof -ti :3456 | xargs kill   then npm run launch:tracker')
        console.log('')
        process.exit(0)
      }
    } catch {
      /* not our server */
    }
    console.error(`Port ${PORT} is in use by another app.`)
    console.error(`  Free it: lsof -ti :${PORT} | xargs kill`)
    console.error('  Then: npm run launch:tracker')
  } else {
    console.error(err)
  }
  process.exit(1)
})
