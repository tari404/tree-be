import { Driver, Node, Integer } from 'neo4j-driver'
import { createStemInput, ID, Leaf, NodeStored, Post, Stem, Tag } from './type'

const inlineLeafRegExp = /\[((?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?)\]\(\s*(@leaf)(?:\s+("(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)))?\s*\)/g

const query = (array: string[]) => array.join('\n')

export class Root {
  private driver: Driver

  constructor(driver: Driver) {
    this.driver = driver
  }

  // Parse

  toTag(node: Node, count?: number): Tag {
    const p = node.properties as any
    const id = node.identity.toString(10)
    return {
      __typename: 'Tag',
      id,
      name: p.name as string,
      tagCount: count || 0,
    }
  }

  toPost(node: Node): Post {
    const p = node.properties as any
    const id = node.identity.toString(10)
    return {
      __typename: 'Post',
      id,
      day: Intl.DateTimeFormat('utc', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }).format(p.day * 86400000),
      stems: {
        nodes: () => this.stemsOfPost(id),
        totalCount: () =>
          this.count(`(p:Post)-[:HAS]->(:Stem) WHERE ID(p) = ${id}`),
      },
      leaves: {
        nodes: () => this.leavesOfPost(id),
        totalCount: () =>
          this.count(
            query([
              '(p:Post)-[:HAS]->(:Stem)-[:GROW]->(:Leaf)',
              `WHERE ID(p) = ${id}`,
            ])
          ),
      },
    }
  }

  toStem(node: Node): Stem {
    const p = node.properties as any
    const id = node.identity.toString(10)
    return {
      __typename: 'Stem',
      id,
      createAt: p.createAt as number,
      flowering: !!p.flowering,
      title: p.title as string,
      tags: () => this.tagsOfStem(id),
      body: p.body as string,
    }
  }

  toLeaf(node: Node): Leaf {
    const p = node.properties as any
    const id = node.identity.toString(10)
    return {
      __typename: 'Leaf',
      id,
      createAt: p.createAt as number,
      title: p.title as string,
    }
  }

  // Helper

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
    return this.toStem(stem)
  }

  async stemsOfPost(pid: ID): Promise<Stem[]> {
    const s = this.driver.session({ defaultAccessMode: 'READ' })
    const stems = await s
      .run(
        query([
          'MATCH (p:Post)-[:HAS]->(s:Stem)',
          'WHERE ID(p) = toInteger($pid)',
          'RETURN s',
          'ORDER BY s.createAt',
        ]),
        { pid }
      )
      .then((result) => {
        return result.records.map((record) => record.get('s') as Node)
      })
    s.close()
    return stems.map((node) => this.toStem(node))
  }

  async leavesOfPost(pid: ID): Promise<Leaf[]> {
    const s = this.driver.session({ defaultAccessMode: 'READ' })
    const stems = await s
      .run(
        query([
          'MATCH (p:Post)-[:HAS]->(:Stem)-[:GROW]->(l:Leaf)',
          'WHERE ID(p) = toInteger($pid)',
          'RETURN l',
          'ORDER BY l.createAt',
        ]),
        { pid }
      )
      .then((result) => {
        return result.records.map((record) => record.get('l') as Node)
      })
    s.close()
    return stems.map((node) => this.toLeaf(node))
  }

  async tagsOfStem(sid: ID): Promise<Tag[]> {
    const s = this.driver.session({ defaultAccessMode: 'READ' })
    const tags = await s
      .run(
        query([
          'MATCH (t:Tag)-[:TAG]->(s:Stem)',
          'WHERE ID(s) = toInteger($sid)',
          'WITH t, SIZE((t)-[]-()) AS count',
          'RETURN t, count',
        ]),
        { sid }
      )
      .then((result) => {
        return result.records.map((record) => ({
          node: record.get('t') as Node,
          count: (record.get('count') as Integer).toNumber(),
        }))
      })
    s.close()
    return tags.map((item) => this.toTag(item.node, item.count))
  }

  async count(match: string): Promise<number> {
    const s = this.driver.session({ defaultAccessMode: 'READ' })
    const count = await s
      .run(`MATCH ${match} RETURN COUNT(*) AS count`)
      .then((result) => {
        return (result.records[0].get('count') as Integer).toNumber()
      })
    s.close()
    return count
  }

  // Query

  async node({ id }: { id: ID }): Promise<NodeStored> {
    const s = this.driver.session({ defaultAccessMode: 'READ' })
    const node = await s
      .run(query(['MATCH (n) WHERE ID(n) = toInteger($id)', 'RETURN n']), {
        id,
      })
      .then((result) => {
        if (!result.records.length) {
          throw new Error('ID不存在！')
        }
        return result.records[0].get('n') as Node
      })
    s.close()
    switch (node.labels[0]) {
      case 'Tag':
        return this.toTag(node)
      case 'Stem':
        return this.toStem(node)
      case 'Leaf':
        return this.toLeaf(node)
      case 'Post':
        return this.toPost(node)
      default:
        return {
          id: node.identity.toString(10),
          __typename: '',
        }
    }
  }

  async posts({ limit = 30 }: { limit: number }): Promise<Post[]> {
    const s = this.driver.session({ defaultAccessMode: 'READ' })
    const posts = await s
      .run(
        query([
          'MATCH (p:Post) RETURN p',
          'ORDER BY p.day DESC',
          'LIMIT toInteger($limit)',
        ]),
        { limit }
      )
      .then((result) => {
        return result.records.map((record) => record.get('p') as Node)
      })
    s.close()
    return posts.map((node) => this.toPost(node))
  }

  async post({ id }: { id: ID }): Promise<Post> {
    const s = this.driver.session({ defaultAccessMode: 'READ' })
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

  async tags({ limit = 30 }: { limit: number }): Promise<Tag[]> {
    const s = this.driver.session({ defaultAccessMode: 'READ' })
    const tags = await s
      .run(
        query([
          'MATCH (t:Tag)',
          'WITH t, SIZE((t)-[]-()) AS count',
          'RETURN t, count',
          'ORDER BY count DESC',
          'LIMIT toInteger($limit)',
        ]),
        { limit }
      )
      .then((result) => {
        return result.records.map((record) => ({
          node: record.get('t') as Node,
          count: (record.get('count') as Integer).toNumber(),
        }))
      })
    s.close()
    return tags.map((item) => this.toTag(item.node, item.count))
  }

  // Mutation

  async createStem({ input }: { input: createStemInput }): Promise<Stem> {
    const today = Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).format(input.specifiedDay || Date.now())
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
            'CREATE (s:Stem { flowering: $flowering, createAt: $createAt })',
            'MERGE (p:Post { day: $day })',
            'CREATE (p)-[:HAS]->(s)',
            'RETURN ID(s) as id',
          ]),
          {
            flowering: !!input.flowering,
            createAt: Date.now(),
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
              id: (record.get('id') as Integer).toString(10),
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
