import postgres from 'postgres';

async function main() {
  for (const dbName of ['mortgage_ai_agent', 'delinquency_poc', 'delinquency_disposable_test', 'postgres']) {
    try {
      const client = postgres(`postgresql://postgres:1937@localhost:5432/${dbName}`);
      const tables = await client`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
      for (const t of tables) {
        try {
          const rows = await client`SELECT * FROM ${client(t.table_name)}`;
          for (const r of rows) {
            const str = JSON.stringify(r);
            if (str.includes('4477')) {
              console.log(`MATCH 4477 in db "${dbName}", table "${t.table_name}":`, r);
            }
          }
        } catch(e) {}
      }
      await client.end();
    } catch(e) {}
  }
  console.log('Search in all DBs finished.');
  process.exit(0);
}

main();
