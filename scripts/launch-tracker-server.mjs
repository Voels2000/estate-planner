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

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is in use. Stop the other process or change PORT in scripts/launch-tracker-server.mjs`)
  } else {
    console.error(err)
  }
  process.exit(1)
})
