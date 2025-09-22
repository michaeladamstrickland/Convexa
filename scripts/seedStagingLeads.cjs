const axios = require('axios');
const { faker } = require('@faker-js/faker');

const STAGING_URL = process.argv[3] || 'http://localhost:3001';
const BASIC_AUTH_USER = process.argv[4] || 'admin';
const BASIC_AUTH_PASS = process.argv[5] || 'password';

const generateLead = () => {
  return {
    property_id: faker.string.uuid(),
    address: faker.location.streetAddress(true),
    owner_name: faker.person.fullName(),
    estimated_value: faker.number.int({ min: 100000, max: 1000000 }),
    condition_score: faker.number.int({ min: 30, max: 90 }),
    vacancy_months: faker.number.int({ min: 0, max: 12 }),
    tax_debt: faker.number.int({ min: 0, max: 50000 }),
    foreclosure_stage: faker.helpers.arrayElement([undefined, 'pre_foreclosure', 'auction']),
    violations: faker.helpers.arrayElements(['code_violation', 'environmental_hazard', 'structural_issue'], { min: 0, max: 2 }),
    is_probate: faker.datatype.boolean(),
    is_divorce: faker.datatype.boolean(),
    eviction_count: faker.number.int({ min: 0, max: 3 }),
    days_on_market: faker.number.int({ min: 1, max: 365 }),
    price_reduction_count: faker.number.int({ min: 0, max: 5 }),
    is_absentee: faker.datatype.boolean(),
    owner_distance_miles: faker.number.int({ min: 0, max: 1000 })
  };
};

const seedLeads = async (count) => {
  console.log(`Seeding ${count} leads to ${STAGING_URL}/api/zip-search-new/add-lead`);
  for (let i = 0; i < count; i++) {
    try {
      const lead = generateLead();
      await axios.post(`${STAGING_URL}/api/zip-search-new/add-lead`, lead, {
        auth: {
          username: BASIC_AUTH_USER,
          password: BASIC_AUTH_PASS
        }
      });
      if ((i + 1) % 50 === 0) {
        console.log(`Seeded ${i + 1} leads...`);
      }
    } catch (error) {
      console.error(`Error seeding lead ${i + 1}:`, error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
    }
  }
  console.log(`Finished seeding ${count} leads.`);
};

const run = async () => {
  const leadCount = process.argv[2] ? parseInt(process.argv[2], 10) : 300;
  if (isNaN(leadCount) || leadCount < 1) {
    console.error('Please provide a valid number of leads to generate (e.g., node scripts/seedStagingLeads.cjs 300 <STAGING_URL> <BASIC_AUTH_USER> <BASIC_AUTH_PASS>)');
    process.exit(1);
  }
  await seedLeads(leadCount);
};

run();
