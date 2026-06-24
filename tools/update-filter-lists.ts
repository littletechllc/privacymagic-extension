import path from "node:path"
import { filterListDir, isMain } from "./util"
import { writeFile } from "node:fs/promises"

const URLS = {
  'easylist.txt': 'https://easylist.to/easylist/easylist.txt',
  'easyprivacy.txt': 'https://easylist.to/easylist/easyprivacy.txt',
  'fanboy-annoyance.txt': 'https://secure.fanboy.co.nz/fanboy-annoyance.txt',
  'small-oisd.txt': 'https://small.oisd.nl'
}

const fetchFilterLists = async (): Promise<void> => {
  for (const [filename, url] of Object.entries(URLS)) {
    const response = await fetch(url)
    const text = await response.text()
    const filePath = path.join(filterListDir, filename)
    await writeFile(filePath, text)
    console.log(`Downloaded ${filename} to ${filePath} with file length ${text.length} bytes`)
  }
}

if (isMain(import.meta)) {
  await fetchFilterLists()
}