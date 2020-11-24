import * as express from 'express'
import * as http from 'http'
import { graphqlHTTP } from 'express-graphql'
import { GraphQLTypeResolver } from 'graphql'
import * as graphqlTools from 'graphql-tools'

import { createDriver } from './lib/driver'
import { Root } from './lib/root'
import { NodeStored } from './lib/type'

import schemaText from './schema.gql'

const schema = graphqlTools.makeExecutableSchema({
  typeDefs: schemaText,
  resolvers: {
    Node: {
      __resolveType: function (a) {
        return a.__typename
      } as GraphQLTypeResolver<NodeStored, http.IncomingMessage>,
    },
  },
})

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
