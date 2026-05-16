import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_SETTING_IDS } from '@src/common/setting-ids'
import { isMain } from './util'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const schemaPath = path.join(projectRoot, 'remote', 'schema.json')

const settingIdEnum = [...ALL_SETTING_IDS].sort()

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://privacymagic.extension/remote/schema.json',
  title: 'Remote config',
  type: 'object',
  additionalProperties: false,
  required: ['version', 'setting_exceptions'],
  properties: {
    $schema: {
      type: 'string',
    },
    version: {
      type: 'integer',
      minimum: 1,
    },
    setting_exceptions: {
      type: 'object',
      propertyNames: {
        enum: settingIdEnum,
      },
      additionalProperties: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
    },
  },
} as const

export const generateRemoteSchema = async (): Promise<void> => {
  await fs.writeFile(schemaPath, `${JSON.stringify(schema, null, 2)}\n`)
}

if (isMain(import.meta)) {
  void generateRemoteSchema()
}
