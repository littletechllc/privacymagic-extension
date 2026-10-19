import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'

export type StaticServer = {
  url: string
  close: () => Promise<void>
}

const contentType = (filePath: string): string => {
  if (filePath.endsWith('.html')) {
    return 'text/html; charset=utf-8'
  }
  if (filePath.endsWith('.js')) {
    return 'text/javascript; charset=utf-8'
  }
  return 'application/octet-stream'
}

const isInsideRoot = (root: string, filePath: string): boolean => {
  const relative = path.relative(root, filePath)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

/**
 * Serves fixture pages over http://127.0.0.1. That origin is a secure context, so
 * APIs such as Battery Status are exposed, and <all_urls> content scripts still run.
 */
export const startStaticServer = async (rootDir: string): Promise<StaticServer> => {
  const root = path.resolve(rootDir)
  const server = http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      let relativePath: string
      try {
        relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '')
      } catch {
        res.writeHead(400)
        res.end()
        return
      }
      const filePath = path.resolve(root, relativePath)
      if (!isInsideRoot(root, filePath)) {
        res.writeHead(403)
        res.end()
        return
      }
      try {
        const data = await fs.readFile(filePath)
        res.writeHead(200, { 'content-type': contentType(filePath) })
        res.end(data)
      } catch {
        res.writeHead(404)
        res.end()
      }
    })().catch((error: unknown) => {
      console.error('fixture server error', error)
      if (!res.headersSent) {
        res.writeHead(500)
      }
      res.end()
    })
  })

  await new Promise<void>((resolve, reject) => {
    const fail = (error: Error): void => {
      reject(error)
    }
    server.once('error', fail)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', fail)
      resolve()
    })
  })

  const address = server.address()
  if (address == null || typeof address === 'string') {
    throw new Error('fixture server did not bind to a TCP port')
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error != null) {
            reject(error)
          } else {
            resolve()
          }
        })
      })
    }
  }
}
