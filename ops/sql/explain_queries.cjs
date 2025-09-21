const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

async function runExplainQueries() {
  try {
    console.log('Running EXPLAIN QUERY PLAN for top queries...');

    // 1. Example for searchLeads with multiple filters
    const searchParams = {
      city: 'Phoenix',
      minValue: 200000,
      source: 'zillow',
      limit: 10,
      page: 1,
      sortBy: 'estimated_value',
      sortOrder: 'desc'
    };

    const explainSearchCountQuery = Prisma.sql`EXPLAIN (ANALYZE, VERBOSE, BUFFERS) SELECT COUNT(*) FROM "Lead" WHERE "address" LIKE ${'%' + searchParams.city + '%'} AND "estimated_value" >= ${searchParams.minValue} AND "source" = ${searchParams.source}`;
    const explainSearchFindManyQuery = Prisma.sql`EXPLAIN (ANALYZE, VERBOSE, BUFFERS) SELECT * FROM "Lead" WHERE "address" LIKE ${'%' + searchParams.city + '%'} AND "estimated_value" >= ${searchParams.minValue} AND "source" = ${searchParams.source} ORDER BY "estimated_value" ${Prisma.raw(searchParams.sortOrder.toUpperCase())} LIMIT ${searchParams.limit} OFFSET ${ (searchParams.page - 1) * searchParams.limit}`;

    console.log('\n--- EXPLAIN for searchLeads (COUNT) ---');
    const searchCountPlan = await prisma.$queryRaw(explainSearchCountQuery);
    console.log(searchCountPlan.map(row => row['QUERY PLAN']).join('\n'));

    console.log('\n--- EXPLAIN for searchLeads (FIND MANY) ---');
    const searchFindManyPlan = await prisma.$queryRaw(explainSearchFindManyQuery);
    console.log(searchFindManyPlan.map(row => row['QUERY PLAN']).join('\n'));

    // 2. Example for getLeadAnalytics temperatureCounts
    const explainTemperatureCountsQuery = Prisma.sql`EXPLAIN (ANALYZE, VERBOSE, BUFFERS) SELECT temperature_tag as tag, COUNT(*) as count FROM "Lead" GROUP BY temperature_tag`;

    console.log('\n--- EXPLAIN for getLeadAnalytics (temperature_tag counts) ---');
    const temperatureCountsPlan = await prisma.$queryRaw(explainTemperatureCountsQuery);
    console.log(temperatureCountsPlan.map(row => row['QUERY PLAN']).join('\n'));

  } catch (error) {
    console.error('Error running EXPLAIN queries:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runExplainQueries();
