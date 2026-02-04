import path from 'node:path'
import { includeIgnoreFile } from '@eslint/compat'
import type { CodegenConfig } from '@graphql-codegen/cli'

// biome-ignore lint/style/noProcessEnv: env needed for codegen config
const env = process.env

const schemaPath = env.GRAPHQL_SCHEMA_PATH
if (!schemaPath) {
  throw new Error(
    'GRAPHQL_SCHEMA_PATH is not set. Set it in .env.development to the local path of:\n' +
      'https://github.com/browseros-ai/BrowserOS-workers/blob/main/apps/api/src/modules/graphql/schema.graphql',
  )
}

const gitignorePath = path.resolve(__dirname, '.gitignore')

const ignorePatterns = includeIgnoreFile(
  gitignorePath,
  'Imported .gitignore patterns',
)

const ignoresList = ignorePatterns.ignores?.map((each) => `!${each}`) ?? []

const config: CodegenConfig = {
  schema: schemaPath,
  documents: ['./**/*.tsx', './**/*.ts', ...ignoresList],
  ignoreNoDocuments: true,
  generates: {
    './generated/graphql/': {
      preset: 'client',
      config: {
        documentMode: 'string',
      },
    },
    './generated/graphql/schema.graphql': {
      plugins: ['schema-ast'],
      config: {
        includeDirectives: true,
      },
    },
  },
}

export default config
