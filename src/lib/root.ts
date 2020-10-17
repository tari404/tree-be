import { Driver, Node } from 'neo4j-driver'
import { CreatePostInput, ID, Leaf, Post, Stem } from './type'

export class Root {
  private driver: Driver

  constructor(driver: Driver) {
    this.driver = driver
  }

  // Parse
  toPost(node: Node): Post {
    const p = node.properties as any
    const id = p.id
    return {
      id,
      createdAt: p.createdAt,
      abstract: '...', // TODO
      stems: {
        nodes: () => this.stemsOfPost({ postID: id }),
        totalCount: () => this.count(`(:Post { id: "${id}" })-[:HAS]->(:Stem)`),
      },
      leaves: {
        nodes: () => this.leavesOfPost({ postID: id }),
        totalCount: () =>
          this.count(`(:Post { id: "${id}" })-[:HAS]->()-[:ARRIVED]->(:Leaf)`),
      },
    }
  }
  toLeaf(node: Node): Leaf {
    const p = node.properties as any
    return {
      id: p.id,
      name: p.name || '',
      // TODO
      isStartNode: false,
      isEndNode: false,
      prev: () => this.emptyLeaf(),
      next: () => Promise.all([this.emptyLeaf()]),
    }
  }

  async count(match: string): Promise<number> {
    const s = this.driver.session()
    const count = await s
      .run(`MATCH ${match} RETURN count(*) AS count`)
      .then((result) => {
        return result.records[0].get('count').toNumber()
      })
    s.close()
    return count
  }

  // Query
  async posts({ limit = 30 }: { limit: number }): Promise<Post[]> {
    const s = this.driver.session()
    const posts = await s
      .run(
        `
MATCH (p:Post)
RETURN p
LIMIT toInteger($limit)
  `,
        {
          limit,
        }
      )
      .then((result) => {
        return result.records.map((record) => record.get('p') as Node)
      })
    s.close()
    return posts.map((node) => this.toPost(node))
  }

  async post({ id }: { id: ID }): Promise<Post> {
    const s = this.driver.session()
    const post = await s
      .run(
        `
MATCH (p:Post { id: $id })
RETURN p
  `,
        {
          id,
        }
      )
      .then((result) => {
        return result.records[0].get('p') as Node
      })
      .catch(() => {
        throw new Error('Post not found')
      })
    s.close()
    return this.toPost(post)
  }

  async stemsOfPost({ postID }: { postID: ID }): Promise<Stem[]> {
    const s = this.driver.session()
    const stems = await s
      .run(
        `
MATCH (:Post { id: $id })-[:HAS]->(s: Stem)
MATCH (l:Leaf)-[:EXTEND]->(s)
RETURN s, l
  `,
        {
          id: postID,
        }
      )
      .then((result) => {
        return result.records.map((resord) => ({
          stem: resord.get('s') as Node,
          origin: resord.get('l') as Node,
        }))
      })
    s.close()
    return stems.map(({ stem, origin }) => {
      const p = stem.properties as any
      return {
        id: p.id,
        title: p.title,
        origin: this.toLeaf(origin),
        rootOrigin: () => this.emptyLeaf(), // TODO
        body: p.body,
      }
    })
  }

  async leavesOfPost({ postID }: { postID: ID }): Promise<Leaf[]> {
    const s = this.driver.session()
    const leaves = await s
      .run(
        `
MATCH (:Post { id: $id })-[:HAS]->(:Stem)-[:ARRIVED]->(l:Leaf)
RETURN l
  `,
        {
          id: postID,
        }
      )
      .then((result) => {
        return result.records.map((resord) => resord.get('l') as Node)
      })
    s.close()
    return leaves.map((node) => this.toLeaf(node))
  }

  async emptyLeaf(): Promise<Leaf> {
    return {
      id: 'test-id',
      name: 'name',
      isStartNode: false,
      isEndNode: false,
      prev: () => this.emptyLeaf(),
      next: () => Promise.all([this.emptyLeaf()]),
    }
  }

  // Mutation
  async createPost({ input }: { input: CreatePostInput }): Promise<Post> {
    const s = this.driver.session()
    const createdAt = input.specifyCreatedAt || Date.now()
    const pID = await s
      .run(
        `
CREATE (p:Post { createdAt: $createdAt, id: apoc.create.uuid() }) WITH p
UNWIND $stems AS stem
OPTIONAL MATCH (ol:Leaf { id: stem.originLeafID })
CALL apoc.when(ol IS NOT NULL,
  'RETURN ol AS o',
  'MATCH (o:RootLeaf) RETURN DISTINCT o',
  { ol: ol }
) YIELD value
WITH value.o AS o, stem, p
CREATE (s:Stem { title: stem.title, body: stem.body })
CREATE (p)-[:HAS]->(s)<-[:EXTEND]-(o)
WITH *
UNWIND stem.leaves AS leaf
CREATE (l:Leaf { name: leaf.name })
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
