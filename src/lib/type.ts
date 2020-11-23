type MaybeAsync<T> = T | Promise<T>
type MaybeFunctional<T> = T | ((...args: any[]) => T)

type Optional<T> = T | null
type Dynamic<T> = MaybeFunctional<MaybeAsync<T>>

export type ID = string

export type DateStored = string

export interface LeafConnection {
  nodes: Dynamic<Leaf[]>
  totalCount: Dynamic<number>
}

export interface Leaf {
  id: ID
  name: string
  isStartNode: boolean
  isEndNode: boolean
  prev: Dynamic<Leaf>
  next: Dynamic<Leaf[]>
}

export interface StemConnection {
  nodes: Dynamic<Stem[]>
  totalCount: Dynamic<number>
}

export interface Stem {
  id: ID
  title: string
  body: string
}

export interface Post {
  id: ID
  day: DateStored
  // stems: Dynamic<StemConnection>
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
  parentID?: ID
  title?: string
  flowering: boolean
  tags: string[]
  body: string
}
