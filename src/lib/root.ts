import { Driver, Node } from 'neo4j-driver'
import { CreatePostInput, ID, Post } from './type'

export class Root {
  private driver: Driver

  constructor(driver: Driver) {
    this.driver = driver
  }

  // Query
  async post({ id }: { id: ID }): Promise<Post> {
    const s = this.driver.session()
    const post = await s
      .run(
        `
MATCH (p: Post { id: $id })
RETURN p
  `,
        {
          id,
        }
      )
      .then((result) => {
        return result.records[0].get('p') as Node
      })
    s.close()
    return {
      id,
      createdAt: (post.properties as any).createdAt,
      // TODO
      abstract: '...',
      // TODO
      stems: {
        nodes: [],
        totalCount: 1,
      },
      // TODO
      leaves: {
        nodes: [],
        totalCount: 1,
      },
    }
  }

  // Mutation
  async createPost({ input }: { input: CreatePostInput }): Promise<Post> {
    const s = this.driver.session()
    const createdAt = input.specifyCreatedAt || Date.now()
    const pID = await s
      .run(
        `
CREATE (p: Post { createdAt: $createdAt, id: apoc.create.uuid() }) WITH p
UNWIND $stems AS stem
OPTIONAL MATCH (ol: Leaf { id: stem.originLeafID })
CALL apoc.when(ol IS NOT NULL,
  'RETURN ol AS o',
  'MATCH (o: RootLeaf) RETURN DISTINCT o',
  { ol: ol }
) YIELD value
WITH value.o AS o, stem, p
CREATE (s: Stem { title: stem.title, body: stem.body })
CREATE (p)-[:HAS]->(s)<-[:EXTEND]-(o)
WITH *
UNWIND stem.leaves AS leaf
CREATE (l: Leaf { name: leaf.name })
CREATE (s)-[:ARRIVED]->(l)<-[:GROW]-(o)
RETURN p.id AS pid
  `,
        {
          createdAt,
          stems: input.stems,
        }
      )
      .then((result) => {
        return result.records[0].get('pid')
      })
    s.close()
    return this.post({ id: pID })
  }
}
