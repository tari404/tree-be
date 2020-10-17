type MaybeAsync<T> = T | Promise<T>
type MaybeFunctional<T> = T | ((...args: any[]) => T)

type Optional<T> = T | null
type Dynamic<T> = MaybeFunctional<MaybeAsync<T>>

export type ID = string

export type DateStored = number

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
  origin: Dynamic<Leaf>
  rootOrigin: Dynamic<Leaf>
  body: string
}

export interface Post {
  id: ID
  createdAt: DateStored
  abstract: String
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

export interface CreatePostInput {
  specifyCreatedAt?: DateStored
  stems: GrowInput[]
}
