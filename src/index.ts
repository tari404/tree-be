import * as express from 'express'
import { graphqlHTTP } from 'express-graphql'
import { buildSchema } from 'graphql'
import { createLeaf, getPost, CreatePostInput } from './orm/main'

import schemaText from './schema.gql'

// 使用 GraphQL schema language 构造一个 schema
const schema = buildSchema(schemaText)

// root 为每个端点入口 API 提供一个解析器
const root = {
  post: () => {
    return getPost()
  },
  createPost: async ({ input }: { input: CreatePostInput }) => {
    const testStem = input.stems[0]
    const leaf = await createLeaf(testStem.leaves[0], testStem.originLeafID)
    console.log(leaf)
    return getPost()
  },
}

const app = express()
app.use(
  '/graphql',
  graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true,
  })
)
app.listen(4000)
console.log('Running a GraphQL API server at localhost:4000/graphql')
