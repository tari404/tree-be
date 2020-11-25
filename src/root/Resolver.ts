import { Driver, Node, Integer } from 'neo4j-driver'
import { ID, Leaf, queryNodeOptions, Stem, Tag } from '../lib/type'
import { query } from '.'
import { Parser } from './Parser'

export class Resolver {
  private d: Driver
  private p?: Parser

  constructor(d: Driver) {
    this.d = d
  }

  bindParser(p: Parser) {
    this.p = p
  }

  async stem({ id }: { id: ID }): Promise<Stem> {
    const s = this.d.session({ defaultAccessMode: 'READ' })
    const stem = await s
      .run('MATCH (s:Stem) WHERE ID(s) = toInteger($id) RETURN s', {
        id,
      })
      .then((result) => result.records[0].get('s') as Node)
    s.close()
    return this.p!.toStem(stem)
  }

  async stemsOfPost(pid: ID): Promise<Stem[]> {
    const s = this.d.session({ defaultAccessMode: 'READ' })
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
      .then((result) => result.records.map((record) => record.get('s') as Node))
    s.close()
    return stems.map((node) => this.p!.toStem(node))
  }

  async leavesOfPost(pid: ID): Promise<Leaf[]> {
    const s = this.d.session({ defaultAccessMode: 'READ' })
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
      .then((result) => result.records.map((record) => record.get('l') as Node))
    s.close()
    return stems.map((node) => this.p!.toLeaf(node))
  }

  async tagsOfStem(sid: ID): Promise<Tag[]> {
    const s = this.d.session({ defaultAccessMode: 'READ' })
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
      .then((result) =>
        result.records.map((record) => ({
          node: record.get('t') as Node,
          count: (record.get('count') as Integer).toNumber(),
        }))
      )
    s.close()
    return tags.map((item) => this.p!.toTag(item.node, item.count))
  }

  async originOfStem(sid: ID): Promise<Leaf | null> {
    const s = this.d.session({ defaultAccessMode: 'READ' })
    const leaf = await s
      .run(
        query([
          'MATCH (l:Leaf)-[:EXTEND]->(s:Stem)',
          'WHERE ID(s) = toInteger($sid)',
          'RETURN DISTINCT l',
        ]),
        { sid }
      )
      .then((result) => {
        if (result.records.length) {
          return result.records[0].get('l') as Node
        } else {
          return null
        }
      })
    s.close()
    return leaf ? this.p!.toLeaf(leaf) : null
  }

  async leavesOfStem(sid: ID): Promise<Leaf[]> {
    const s = this.d.session({ defaultAccessMode: 'READ' })
    const leaves = await s
      .run(
        query([
          'MATCH (s:Stem)-[:GROW]->(l:Leaf)',
          'WHERE ID(s) = toInteger($sid)',
          'RETURN l',
          'ORDER BY l.createAt',
        ]),
        { sid }
      )
      .then((result) => result.records.map((record) => record.get('l') as Node))
    s.close()
    return leaves.map((node) => this.p!.toLeaf(node))
  }

  async originOfLeaf(lid: ID): Promise<Stem> {
    const s = this.d.session({ defaultAccessMode: 'READ' })
    const stem = await s
      .run(
        query([
          'MATCH (s:Stem)-[:GROW]->(l:Leaf)',
          'WHERE ID(l) = toInteger($lid)',
          'RETURN DISTINCT s',
        ]),
        { lid }
      )
      .then((result) => result.records[0].get('s') as Node)
    s.close()
    return this.p!.toStem(stem)
  }

  async stemsOfLeaf(lid: ID): Promise<Stem[]> {
    const s = this.d.session({ defaultAccessMode: 'READ' })
    const stems = await s
      .run(
        query([
          'MATCH (l:Leaf)-[:EXTEND]->(s:Stem)',
          'WHERE ID(l) = toInteger($lid)',
          'RETURN s',
          'ORDER BY s.createAt',
        ]),
        { lid }
      )
      .then((result) => result.records.map((record) => record.get('s') as Node))
    s.close()
    return stems.map((node) => this.p!.toStem(node))
  }

  async stems({ limit = 30 }: queryNodeOptions): Promise<Stem[]> {
    const s = this.d.session({ defaultAccessMode: 'READ' })
    const stems = await s
      .run(
        query([
          'MATCH (s:Stem)',
          'RETURN s',
          'ORDER BY s.createAt',
          'LIMIT toInteger($limit)',
        ]),
        { limit }
      )
      .then((result) => result.records.map((record) => record.get('s') as Node))
    s.close()
    return stems.map((node) => this.p!.toStem(node))
  }

  async flowers({ limit = 30 }: queryNodeOptions): Promise<Stem[]> {
    const s = this.d.session({ defaultAccessMode: 'READ' })
    const fruits = await s
      .run(
        query([
          'MATCH (s:Stem { flowering: true })',
          'RETURN s',
          'ORDER BY s.createAt',
          'LIMIT toInteger($limit)',
        ]),
        { limit }
      )
      .then((result) => result.records.map((record) => record.get('s') as Node))
    s.close()
    return fruits.map((node) => this.p!.toStem(node))
  }

  async seeds({ limit = 30 }: queryNodeOptions): Promise<Stem[]> {
    const s = this.d.session({ defaultAccessMode: 'READ' })
    const seeds = await s
      .run(
        query([
          'MATCH (s:Stem)',
          'WHERE NOT (:Leaf)-[:EXTEND]->(s) AND (s)-[:GROW]->(:Leaf)',
          'RETURN s',
          'ORDER BY s.createAt',
          'LIMIT toInteger($limit)',
        ]),
        { limit }
      )
      .then((result) => result.records.map((record) => record.get('s') as Node))
    s.close()
    return seeds.map((node) => this.p!.toStem(node))
  }

  async fruits({ limit = 30 }: queryNodeOptions): Promise<Stem[]> {
    const s = this.d.session({ defaultAccessMode: 'READ' })
    const fruits = await s
      .run(
        query([
          'MATCH (s:Stem)',
          'WHERE NOT (:Leaf)-[:EXTEND]->(s) AND NOT (s)-[:GROW]->(:Leaf)',
          'RETURN s',
          'ORDER BY s.createAt',
          'LIMIT toInteger($limit)',
        ]),
        { limit }
      )
      .then((result) => result.records.map((record) => record.get('s') as Node))
    s.close()
    return fruits.map((node) => this.p!.toStem(node))
  }

  async leaves({ limit = 30 }: queryNodeOptions): Promise<Leaf[]> {
    const s = this.d.session({ defaultAccessMode: 'READ' })
    const leaves = await s
      .run(
        query([
          'MATCH (l:Leaf)',
          'RETURN l',
          'ORDER BY l.createAt',
          'LIMIT toInteger($limit)',
        ]),
        { limit }
      )
      .then((result) => result.records.map((record) => record.get('l') as Node))
    s.close()
    return leaves.map((node) => this.p!.toLeaf(node))
  }

  async count(match: string): Promise<number> {
    const s = this.d.session({ defaultAccessMode: 'READ' })
    const count = await s
      .run(`MATCH ${match} RETURN COUNT(*) AS count`)
      .then((result) => (result.records[0].get('count') as Integer).toNumber())
    s.close()
    return count
  }
}
