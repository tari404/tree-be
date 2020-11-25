import { Node } from 'neo4j-driver'
import { Leaf, Stem, Tag, Post } from '../lib/type'
import { query } from '.'
import { Resolver } from './Resolver'

export class Parser {
  private r: Resolver

  constructor(r: Resolver) {
    this.r = r
  }

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
      day: p.day,
      stems: {
        nodes: () => this.r.stemsOfPost(id),
        totalCount: () =>
          this.r.count(`(p:Post)-[:HAS]->(:Stem) WHERE ID(p) = ${id}`),
      },
      leaves: {
        nodes: () => this.r.leavesOfPost(id),
        totalCount: () =>
          this.r.count(
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
      tags: () => this.r.tagsOfStem(id),
      body: p.body as string,
      originLeaf: () => this.r.originOfStem(id),
      leaves: {
        nodes: () => this.r.leavesOfStem(id),
        totalCount: () =>
          this.r.count(`(s:Stem)-[:GROW]->(l:Leaf) WHERE ID(s) = ${id}`),
      },
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
      originStem: () => this.r.originOfLeaf(id),
      stems: {
        nodes: () => this.r.stemsOfLeaf(id),
        totalCount: () =>
          this.r.count(`(l:Leaf)-[:EXTEND]->(:Stem) WHERE ID(l) = ${id}`),
      },
    }
  }
}
