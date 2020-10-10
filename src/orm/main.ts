import neo4j from 'neo4j-driver'

const uri = 'neo4j://localhost'
const user = 'neo4j'
const password = '12345678'

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password))

;(() => {
  const session = driver.session()
  session.run('MERGE (o: RootLeaf { id: "_rootleaf" })').then(() => {
    session.close()
  })
})()

interface LeafInput {
  name: string
}

interface GrowInput {
  originLeafID: string
  title: string
  body: string
  leaves: [LeafInput]
}

export interface CreatePostInput {
  specifyCreatedAt?: number
  stems: [GrowInput]
}

export const createLeaf = async (input: LeafInput, oLeafID?: string) => {
  const originID = oLeafID || '_rootleaf'
  const session = driver.session()
  const leaf = await session
    .run(
      [
        'MATCH (origin { id: $id })',
        'CREATE (origin)-[:GROW]->(leaf: Leaf { id: apoc.create.uuid(), name: $name })',
        'RETURN leaf',
      ].join('\n'),
      {
        id: originID,
        name: input.name,
      }
    )
    .then((result) => {
      return result.records[0].get('leaf')
    })
    .finally(() => {
      session.close()
    })
  return leaf
}

export const createPost = (input: CreatePostInput) => {
  // TODO
}

export const getPost = () => {
  return {
    id: '1234',
    createdAt: Date.now(),
    leaves: () => {
      return {
        nodes: [],
        totalCount: 5,
      }
    },
  }
}
