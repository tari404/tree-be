import { Driver, Node, Integer } from 'neo4j-driver'
import {
  createStemInput,
  DayInput,
  ID,
  Leaf,
  NodeStored,
  Panel,
  Post,
  queryNodeOptions,
  Stem,
  Tag,
} from '../lib/type'
import { Resolver } from './Resolver'
import { Parser } from './Parser'

const inlineLeafRegExp = /\[((?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?)\]\(\s*(@leaf)(?:\s+("(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)))?\s*\)/g

export const query = (array: string[]) => array.join('\n')

export class Root {
  private driver: Driver
  private r: Resolver
  private p: Parser

  constructor(driver: Driver) {
    this.driver = driver

    this.r = new Resolver(driver)
    this.p = new Parser(this.r)
    this.r.bindParser(this.p)
  }

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
        return this.p.toTag(node)
      case 'Stem':
        return this.p.toStem(node)
      case 'Leaf':
        return this.p.toLeaf(node)
      case 'Post':
        return this.p.toPost(node)
      default:
        return {
          id: node.identity.toString(10),
          __typename: '',
        }
    }
  }

  async panel(): Promise<Panel> {
    return {
      posts: this.posts.bind(this),
      stems: this.r.stemsResolver(),
      flowers: this.r.stemsResolver('(s:Stem { flowering: true })'),
      seeds: this.r.stemsResolver(
        '(s:Stem) WHERE NOT (:Leaf)-[:EXTEND]->(s) AND (s)-[:GROW]->(:Leaf)'
      ),
      fruits: this.r.stemsResolver(
        '(s:Stem) WHERE NOT (:Leaf)-[:EXTEND]->(s) AND NOT (s)-[:GROW]->(:Leaf)'
      ),
      leaves: (options: queryNodeOptions) => ({
        totalCount: () => this.r.count('(:Leaf)'),
        nodes: () => this.r.leaves(options),
      }),
    }
  }

  async posts(options: queryNodeOptions): Promise<Post[]> {
    const s = this.driver.session({ defaultAccessMode: 'READ' })
    const filters: string[] = []
    if (options.earlyThan) {
      filters.push(`p.day < ${options.earlyThan}`)
    }
    if (options.lateThan) {
      filters.push(`p.day > ${options.earlyThan}`)
    }
    const limit = options.limit || 30
    const posts = await s
      .run(
        query([
          'MATCH (p:Post)',
          filters.length ? 'WHERE ' + filters.join(' AND ') : '',
          'RETURN p',
          'ORDER BY p.day DESC',
          'LIMIT toInteger($limit)',
        ]),
        { limit }
      )
      .then((result) => result.records.map((record) => record.get('p') as Node))
    s.close()
    return posts.map((node) => this.p.toPost(node))
  }

  async post({ day }: { day: DayInput }): Promise<Post | null> {
    const s = this.driver.session({ defaultAccessMode: 'READ' })
    const post = await s
      .run(query(['MATCH (p:Post { day: $day })', 'RETURN p']), {
        day,
      })
      .then((result) => {
        if (result.records.length) {
          return result.records[0].get('p') as Node
        } else {
          return null
        }
      })
    s.close()
    return post ? this.p.toPost(post) : null
  }

  async matchedLeaves({ matching }: { matching: string }): Promise<Leaf[]> {
    if (!matching) {
      return []
    }
    const s = this.driver.session({ defaultAccessMode: 'READ' })
    const leaves = await s
      .run(
        query([
          'MATCH (l:Leaf)',
          `WHERE l.title =~ "(?i).*${matching}.*"`,
          'RETURN l',
        ])
      )
      .then((result) => result.records.map((record) => record.get('l') as Node))
    s.close()
    return leaves.map((node) => this.p.toLeaf(node))
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
      .then((result) =>
        result.records.map((record) => ({
          node: record.get('t') as Node,
          count: (record.get('count') as Integer).toNumber(),
        }))
      )
    s.close()
    return tags.map((item) => this.p.toTag(item.node, item.count))
  }

  async matchedTags({ matching }: { matching: string }): Promise<Tag[]> {
    if (!matching) {
      return []
    }
    const s = this.driver.session({ defaultAccessMode: 'READ' })
    const tags = await s
      .run(
        query([
          'MATCH (t:Tag)',
          `WHERE t.name =~ "(?i).*${matching}.*"`,
          'WITH t, SIZE((t)-[]-()) AS count',
          'RETURN t, count',
        ])
      )
      .then((result) =>
        result.records.map((record) => ({
          node: record.get('t') as Node,
          count: (record.get('count') as Integer).toNumber(),
        }))
      )
    s.close()
    return tags.map((item) => this.p.toTag(item.node, item.count))
  }

  // Mutation

  async createStem({ input }: { input: createStemInput }): Promise<Stem> {
    const today = Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).format(Date.now())
    const day =
      input.specifiedDay ||
      Math.round(new Date(today + 'Z').getTime() / 86400000)

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
    return this.r.stem({ id })
  }
}
