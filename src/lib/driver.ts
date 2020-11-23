import neo4j from 'neo4j-driver'

// ** DEV **
const uri = 'neo4j://localhost'
const user = 'neo4j'
const password = '12345678'

export const createDriver = () => {
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password))
  ;(async () => {
    const s = driver.session()
    const version = await s
      .run('OPTIONAL MATCH (root:Root) RETURN root.version')
      .then((result) => {
        return result.records[0].get('root.version')
      })

    if (!version) {
      console.log('Initialize database...')

      await s.run(`
        CREATE CONSTRAINT unique_left_title IF NOT EXISTS
        ON (n:Leaf)
        ASSERT n.title IS UNIQUE
      `)

      await s.run('CREATE (r:Root { version: "1.0.0" })')
    }
    s.close()
  })()
  return driver
}
