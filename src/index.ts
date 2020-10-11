import * as express from 'express'
import { graphqlHTTP } from 'express-graphql'
import { buildSchema } from 'graphql'
import { createDriver } from './lib/driver'
import { Root } from './lib/root'

import schemaText from './schema.gql'

const schema = buildSchema(schemaText)

const driver = createDriver()

const root = new Root(driver)

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
