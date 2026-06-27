import path from "node:path"
import { filterListDir, isMain } from "./util"
import { FILTER_LIST_URL_MAPPING } from "./filter-list-url-mapping"
import { writeFile } from "node:fs/promises"

const fetchFilterLists = async (): Promise<void> => {
  for (const [filename, url] of Object.entries(FILTER_LIST_URL_MAPPING)) {
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