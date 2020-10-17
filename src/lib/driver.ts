import neo4j from 'neo4j-driver'

// ** DEV **
const uri = 'neo4j://localhost'
const user = 'neo4j'
const password = '12345678'

export const createDriver = () => {
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password))
  ;(async () => {
    const s = driver.session()
    const rootID = await s
      .run('OPTIONAL MATCH (root:RootLeaf) RETURN root.id')
      .then((result) => {
        return result.records[0].get('root.id')
      })

    if (!rootID) {
      console.log('Initialize database...')

      for (const label of ['Post', 'Stem', 'Leaf']) {
        await s.run(
          `CREATE CONSTRAINT unique_uuid_${label} IF NOT EXISTS ON (node:${label}) ASSERT node.id IS UNIQUE`
        )
        const installed = await s
          .run(
            `
CALL apoc.uuid.install('${label}', { uuidProperty: 'id' })
YIELD installed
RETURN installed
`
          )
          .then((result) => {
            return result.records[0].get('installed')
          })
        if (installed) {
          console.log(`Successfully add uuid for label: ${label}`)
        }
      }
      await s.run('CREATE (root:RootLeaf:Leaf { name: "ROOT_LEAF" })')
    }
    s.close()
  })()
  return driver
}
