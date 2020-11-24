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
}

export interface StemConnection {
  nodes: Dynamic<Stem[]>
  totalCount: Dynamic<number>
}

export interface Leaf extends NodeStored {
  createAt: Date
  title: string
}

export interface LeafConnection {
  nodes: Dynamic<Leaf[]>
  totalCount: Dynamic<number>
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

export interface LeafInput {
  name: string
}

export interface GrowInput {
  originLeafID: ID
  title: string
  body: string
  leaves: LeafInput[]
}

export interface createStemInput {
  specifiedDay?: DayInput
  parentID?: ID
  title?: string
  flowering: boolean
  tags: string[]
  body: string
}
