import { Driver, Node } from 'neo4j-driver'
import { createStemInput, ID, Post, Stem } from './type'

const inlineLeafRegExp = /\[((?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?)\]\(\s*(@leaf)(?:\s+("(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)))?\s*\)/g

const query = (array: string[]) => array.join('\n')

export class Root {
  private driver: Driver

  constructor(driver: Driver) {
    this.driver = driver
  }

  // Parse
  toPost(node: Node): Post {
    const p = node.properties as any
    return {
      id: node.identity.toString(10),
      day: Intl.DateTimeFormat('utc', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }).format(p.day * 86400000),
      // stems: {
      //   nodes: () => this.stemsOfPost({ postID: id }),
      //   totalCount: () => this.count(`(:Post { id: "${id}" })-[:HAS]->(:Stem)`),
      // },
    }
  }

  //   async count(match: string): Promise<number> {
  //     const s = this.driver.session()
  //     const count = await s
  //       .run(`MATCH ${match} RETURN count(*) AS count`)
  //       .then((result) => {
  //         return result.records[0].get('count').toNumber()
  //       })
  //     s.close()
  //     return count
  //   }

  // Query
  async posts({ limit = 30 }: { limit: number }): Promise<Post[]> {
    const s = this.driver.session()
    const posts = await s
      .run(query(['MATCH (p:Post) RETURN p', 'LIMIT toInteger($limit)']), {
        limit,
      })
      .then((result) => {
        return result.records.map((record) => record.get('p') as Node)
      })
    s.close()
    return posts.map((node) => this.toPost(node))
  }

  async post({ id }: { id: ID }): Promise<Post> {
    const s = this.driver.session()
    const post = await s
      .run(query(['MATCH (p:Post) WHERE ID(p) = toInteger($id)', 'RETURN p']), {
        id,
      })
      .then((result) => {
        return result.records[0].get('p') as Node
      })
    s.close()
    return this.toPost(post)
  }

  async stem({ id }: { id: ID }): Promise<Stem> {
    const s = this.driver.session()
    const stem = await s
      .run('MATCH (s:Stem) WHERE ID(s) = toInteger($id) RETURN s', {
        id,
      })
      .then((result) => {
        return result.records[0].get('s') as Node
      })
    s.close()
    const p = stem.properties as any
    return {
      id: stem.identity.toString(10),
      title: p.title,
      body: p.body,
    }
  }

  // Mutation

  async createStem({ input }: { input: createStemInput }): Promise<Stem> {
    const today = Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).format(Date.now())
    const day = Math.round(new Date(today + 'Z').getTime() / 86400000)

    if (!!input.parentID === !!input.title) {
      throw new Error('参数 parentID 及 title 必须且只能提供其中一个！')
    }

    let body = input.body
    const toCreateLeaves = body.match(inlineLeafRegExp)
    const leaves: string[] = []
    if (toCreateLeaves) {
      for (const leaf of toCreateLeaves) {
        const leafTitle = leaf.replace(/\]\(.+\)$/, '').replace(/^\[/, '')
        leaves.push(leafTitle)
      }
    }

    const s = this.driver.session()
    const txc = s.beginTransaction()
    let id: string
    try {
      // Create new Stem
      id = await txc
        .run(
          query([
            'CREATE (s:Stem { flowering: $flowering })',
            'MERGE (p:Post { day: $day })',
            'CREATE (p)-[:HAS]->(s)',
            'RETURN ID(s) as id',
          ]),
          {
            flowering: !!input.flowering,
            day,
          }
        )
        .then((result) => result.records[0].get('id') as string)

      // Link Tags
      if (input.tags.length) {
        await txc.run(
          query([
            'MATCH (s:Stem) WHERE ID(s) = toInteger($id)',
            'UNWIND $tags AS tag',
            'MERGE (t:Tag { name: tag })',
            'CREATE (t)-[:TAG]->(s)',
            'RETURN t',
          ]),
          {
            id,
            tags: input.tags,
          }
        )
      }

      // Create new Leaves (if existed) and get their IDs
      if (leaves.length) {
        const createdLeaves = await txc
          .run(
            query([
              'MATCH (s:Stem) WHERE ID(s) = toInteger($id)',
              'UNWIND $leaves AS leaf',
              'CREATE (s)-[:GROW]->(l:Leaf { title: leaf })',
              'RETURN ID(l) AS id, leaf',
            ]),
            {
              id,
              leaves,
            }
          )
          .then((result) =>
            result.records.map((record) => ({
              id: record.get('id').toNumber() as number,
              title: record.get('leaf') as string,
            }))
          )
        for (const leaf of createdLeaves) {
          body = body.replace(
            leaf.title + '](@leaf',
            leaf.title + '](@leaf:' + leaf.id
          )
        }
      }

      // Link parent Leaf (if existed)
      let title = input.title || ''
      if (typeof input.parentID !== 'undefined') {
        title = await txc
          .run(
            query([
              'MATCH (ol:Leaf), (s:Stem)',
              `WHERE ID(ol) = toInteger($pid) AND ID(s) = toInteger($id)`,
              'CREATE (ol)-[:EXTEND]->(s)',
              'RETURN ol.title AS title',
            ]),
            { id, pid: input.parentID }
          )
          .then((result) => result.records[0].get('title') as string)
      }

      // Set properties of new Stem
      await txc.run(
        query([
          'MATCH (s:Stem) WHERE ID(s) = toInteger($id)',
          'SET s.body = $body, s.title = $title',
        ]),
        { id, body, title }
      )

      await txc.commit()
    } catch (err) {
      console.log(err.message || err)
      await txc.rollback()
      throw err
    } finally {
      await s.close()
    }
    return this.stem({ id })
  }
}
