import * as express from 'express'
import http from 'http'
import { graphqlHTTP } from 'express-graphql'
import { GraphQLScalarType, GraphQLTypeResolver } from 'graphql'
import * as graphqlTools from 'graphql-tools'

import { createDriver } from './lib/driver'
import { Root } from './root'
import { NodeStored } from './lib/type'

import schemaText from './schema.gql'
import { setPwd } from './lib/auth'

const DayScalarType = new GraphQLScalarType({
  name: 'Day',
  description: 'Date information of daily precision',
  serialize(value: number) {
    return new Date(value * 86400000)
      .toISOString()
      .substr(0, 10)
      .split('-')
      .map((n) => Number(n))
      .join('-')
  },
  parseValue(value: string | number) {
    const date = new Date(value)
    if (!date.getTime()) {
      throw new TypeError(
        `Input parameter: ${value} cannot be resolved to type Day!`
      )
    }
    const day = Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).format(date)
    return Math.round(new Date(day + 'Z').getTime() / 86400000)
  },
  parseLiteral(ast) {
    let date: Date | undefined
    if (ast.kind === 'IntValue') {
      const timestamp = +ast.value
      if (timestamp < 1e6) {
        return timestamp
      } else {
        date = new Date(timestamp)
      }
    } else if (ast.kind === 'StringValue') {
      date = new Date(ast.value)
    }
    if (date && date.getTime()) {
      const day = Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }).format(date)
      return Math.round(new Date(day + 'Z').getTime() / 86400000)
    } else {
      throw new TypeError(
        `Input parameter: ${ast} cannot be resolved to type Day!`
      )
    }
  },
})

const schema = graphqlTools.makeExecutableSchema({
  typeDefs: schemaText,
  resolvers: {
    Node: {
      __resolveType: function (a) {
        return a.__typename
      } as GraphQLTypeResolver<NodeStored, http.IncomingMessage>,
    },
    Day: DayScalarType,
  },
})

const driver = createDriver()

const root = new Root(driver)

setPwd(process.argv[2])

const app = express()
app.get('/', (_, res) => {
  res.send('Hello!')
})
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
