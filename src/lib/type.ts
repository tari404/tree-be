type MaybeAsync<T> = T | Promise<T>
type MaybeFunctional<T> = T | ((...args: any[]) => T)

type Dynamic<T> = MaybeFunctional<MaybeAsync<T>>

export type ID = string

export type DayInput = number
export type DayStored = string
export type Date = number

export interface NodeStored {
  id: ID
  __typename: string
}

export interface Tag extends NodeStored {
  name: string
  tagCount: number
}

export interface Stem extends NodeStored {
  createAt: Date
  flowering: boolean
  title: string
  tags: Dynamic<Tag[]>
  body: string
  originLeaf: Dynamic<Leaf | null>
  leaves: Dynamic<LeafConnection>
}

export interface StemConnection {
  nodes: Dynamic<Stem[]>
  totalCount: Dynamic<number>
}

export interface Leaf extends NodeStored {
  createAt: Date
  title: string
  originStem: Dynamic<Stem>
  stems: Dynamic<StemConnection>
}

export interface LeafConnection {
  nodes: Dynamic<Leaf[]>
  totalCount: Dynamic<number>
}

export interface Post extends NodeStored {
  day: DayStored
  stems: Dynamic<StemConnection>
  leaves: Dynamic<LeafConnection>
}

export interface Panel {
  posts: Dynamic<Post[]>
  stems: Dynamic<StemConnection>
  flowers: Dynamic<StemConnection>
  seeds: Dynamic<StemConnection>
  fruits: Dynamic<StemConnection>
  leaves: Dynamic<LeafConnection>
}

export interface createStemInput {
  specifiedDay?: DayInput
  parentID?: ID
  title?: string
  flowering: boolean
  tags: string[]
  body: string
}

export interface queryNodeOptions {
  limit?: number
  earlyThan?: DayInput
  lateThan?: DayInput
}
