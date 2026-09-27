import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

function sriAttributePlugin() {
  return {
    name: 'pixiu-sri-attributes',
    apply: 'build',
    enforce: 'post',
    async closeBundle() {
      const distDir = path.resolve(import.meta.dirname, 'dist')
      const indexPath = path.join(distDir, 'index.html')
      const html = await readFile(indexPath, 'utf8')
      const manifest = {}
      const resourcePattern = /<(script|link)\b[^>]*?(?:src|href)="(\/[^"]+\.(?:js|css))"[^>]*>/gi

      let output = html
      for (const match of html.matchAll(resourcePattern)) {
        const tag = match[0]
        const url = match[2]
        const filePath = path.join(distDir, decodeURIComponent(url.slice(1)))
        const relativePath = path.relative(distDir, filePath)
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
          throw new Error('SRI resource escapes dist: ' + url)
        }

        const body = await readFile(filePath)
        const integrity = 'sha384-' + createHash('sha384').update(body).digest('base64')
        manifest[url] = integrity

        if (!/\bintegrity=/i.test(tag)) {
          const nextTag = tag.replace(/\s*>$/, ' integrity="' + integrity + '" crossorigin="anonymous">')
          output = output.replace(tag, nextTag)
        }
      }

      await writeFile(indexPath, output)
      await mkdir(path.join(distDir, 'security'), { recursive: true })
      await writeFile(
        path.join(distDir, 'security', 'sri-manifest.json'),
        JSON.stringify({ algorithm: 'sha384', resources: manifest }, null, 2) + '\n',
      )
    },
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    sriAttributePlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
