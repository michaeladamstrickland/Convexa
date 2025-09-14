import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedDatabase() {
  console.log('🌱 Seeding database with realistic real estate leads...');

  // Sample probate cases - real data structure
  const probateCases = [
    {
      case_number: 'PB2024-001234',
      deceased_name: 'Robert Johnson',
      filing_date: new Date('2024-01-15'),
      case_status: 'filed',
      county: 'Maricopa',
      estimated_estate_value: 450000,
      properties_json: JSON.stringify({
        primary_residence: {
          address: '1247 E Washington St, Phoenix, AZ 85034',
          estimated_value: 320000,
          mortgage_balance: 85000,
          equity: 235000
        }
      }),
      heirs_json: JSON.stringify({
        primary_heir: {
          name: 'Sarah Johnson-Martinez',
          relationship: 'daughter',
          inheritance_priority: 1,
          motivation_score: 85
        }
      }),
      urgency_score: 92,
      deal_potential_score: 88,
      next_hearing_date: new Date('2024-02-20'),
      attorney_name: 'Michael Stevens',
      attorney_phone: '(602) 555-0123'
    },
    {
      case_number: 'PB2024-001267',
      deceased_name: 'Margaret Williams',
      filing_date: new Date('2024-01-18'),
      case_status: 'active',
      county: 'Maricopa',
      estimated_estate_value: 680000,
      properties_json: JSON.stringify({
        primary_residence: {
          address: '3456 N Scottsdale Rd, Scottsdale, AZ 85251',
          estimated_value: 520000,
          mortgage_balance: 0,
          equity: 520000
        },
        rental_property: {
          address: '789 W Thomas Rd, Phoenix, AZ 85013',
          estimated_value: 160000,
          mortgage_balance: 45000,
          equity: 115000
        }
      }),
      heirs_json: JSON.stringify({
        heir_1: {
          name: 'David Williams',
          relationship: 'son',
          inheritance_priority: 1,
          motivation_score: 75
        },
        heir_2: {
          name: 'Lisa Williams-Brown',
          relationship: 'daughter',
          inheritance_priority: 1,
          motivation_score: 90
        }
      }),
      urgency_score: 96,
      deal_potential_score: 94
    }
  ];

  // Property violations - real distressed properties
  const violations = [
    {
      property_address: '2847 E McDowell Rd, Phoenix, AZ 85008',
      violation_type: 'structural_unsafe',
      severity_score: 95,
      repeat_offender: true,
      financial_burden: 35000,
      compliance_deadline: new Date('2024-03-01'),
      enforcement_stage: 'court_order',
      deal_potential: 88
    },
    {
      property_address: '1634 W Indian School Rd, Phoenix, AZ 85015',
      violation_type: 'health_safety',
      severity_score: 78,
      repeat_offender: false,
      financial_burden: 12000,
      compliance_deadline: new Date('2024-02-15'),
      enforcement_stage: 'citation',
      deal_potential: 72
    }
  ];

  // High-value leads derived from probate and violations with updated fields
  const leads = [
    {
      address: '1247 E Washington St, Phoenix, AZ 85034',
      owner_name: 'Sarah Johnson-Martinez (Heir)',
      phone: '(480) 555-0156',
      email: 'sarah.jmartinez@email.com',
      source_type: 'probate_intelligence',
      source: 'probate',
      motivation_score: 88,
      estimated_value: 320000,
      equity: 235000,
      condition_score: 78,
      tax_debt: 0,
      violations: 0,
      is_probate: true,
      is_vacant: false,
      lead_score: 94,
      aiScore: 90,
      phones: JSON.stringify(['(480) 555-0156', '(480) 555-9876']),
      emails: JSON.stringify(['sarah.jmartinez@email.com']),
      raw_data: JSON.stringify({
        probate_id: 'PB2024-001234',
        inheritance_info: 'Sole heir to the property',
        deceased_relation: 'Father'
      }),
      temperature_tag: 'ON_FIRE',
      status: 'NEGOTIATING',
      notes: 'Recent probate filing. Heir lives out of state (California). High motivation to sell quickly. No mortgage, significant equity.'
    },
    {
      address: '3456 N Scottsdale Rd, Scottsdale, AZ 85251',
      owner_name: 'Williams Family Trust',
      source_type: 'probate_intelligence',
      source: 'probate',
      motivation_score: 85,
      estimated_value: 520000,
      equity: 520000,
      condition_score: 85,
      tax_debt: 0,
      violations: 0,
      is_probate: true,
      is_vacant: true,
      lead_score: 92,
      aiScore: 85,
      phones: JSON.stringify([]),
      emails: JSON.stringify(['trustee@williamstrust.org']),
      raw_data: JSON.stringify({
        probate_id: 'PB2024-001267',
        trust_details: 'Family trust with multiple beneficiaries'
      }),
      temperature_tag: 'HOT',
      status: 'CONTACTED',
      notes: 'High-value Scottsdale property. Multiple heirs, potential for quick sale. Property currently vacant.'
    },
    {
      address: '2847 E McDowell Rd, Phoenix, AZ 85008',
      owner_name: 'Carlos Rodriguez',
      phone: '(602) 555-0198',
      source_type: 'code_violation_tracking',
      source: 'violation',
      motivation_score: 92,
      estimated_value: 180000,
      equity: 95000,
      condition_score: 35,
      tax_debt: 8500,
      violations: 3,
      is_probate: false,
      is_vacant: true,
      lead_score: 89,
      aiScore: 95,
      phones: JSON.stringify(['(602) 555-0198', '(602) 555-3344']),
      emails: JSON.stringify(['carlos.r@example.com']),
      raw_data: JSON.stringify({
        violation_ids: ['CV-2024-134', 'CV-2024-156', 'CV-2024-189'],
        court_date: '2024-03-15'
      }),
      temperature_tag: 'ON_FIRE',
      status: 'UNDER_CONTRACT',
      notes: 'Multiple code violations, facing court order. Owner overwhelmed with repair costs. High motivation to sell as-is.'
    },
    {
      address: '1634 W Indian School Rd, Phoenix, AZ 85015',
      owner_name: 'Jennifer Thompson',
      source_type: 'code_violation_tracking',
      source: 'violation',
      motivation_score: 75,
      estimated_value: 245000,
      equity: 145000,
      condition_score: 55,
      tax_debt: 2800,
      violations: 1,
      is_probate: false,
      is_vacant: false,
      lead_score: 76,
      aiScore: 70,
      phones: JSON.stringify(['(602) 555-7788']),
      emails: JSON.stringify(['jennifer.t@example.com']),
      raw_data: JSON.stringify({
        violation_id: 'CV-2024-203',
        violation_type: 'Health and safety'
      }),
      temperature_tag: 'WARM',
      status: 'CONTACTED',
      notes: 'Health & safety violation. Recent citation issued. Owner may be motivated to sell rather than repair.'
    },
    {
      address: '5678 E Camelback Rd, Phoenix, AZ 85018',
      owner_name: 'Phoenix Investment LLC',
      source_type: 'tax_delinquency',
      source: 'tax_lien',
      motivation_score: 68,
      estimated_value: 380000,
      equity: 280000,
      condition_score: 70,
      tax_debt: 15600,
      violations: 0,
      is_probate: false,
      is_vacant: true,
      lead_score: 71,
      aiScore: 65,
      phones: JSON.stringify(['(480) 555-2233']),
      emails: JSON.stringify(['contact@phoenixinvest.com']),
      raw_data: JSON.stringify({
        tax_lien_amount: 15600,
        lien_filing_date: '2024-01-05'
      }),
      temperature_tag: 'WARM',
      status: 'NEW',
      notes: 'Investment property with delinquent taxes. LLC may liquidate to avoid foreclosure.'
    },
    {
      address: '9012 N Central Ave, Phoenix, AZ 85020',
      owner_name: 'David Wilson',
      source_type: 'divorce_filing',
      source: 'divorce',
      motivation_score: 25,
      estimated_value: 425000,
      equity: 210000,
      condition_score: 90,
      tax_debt: 0,
      violations: 0,
      is_probate: false,
      is_vacant: false,
      lead_score: 30,
      aiScore: 25,
      phones: JSON.stringify(['(602) 555-8899']),
      emails: JSON.stringify(['david.wilson@example.com']),
      raw_data: JSON.stringify({
        divorce_case_number: 'FD-2024-0578',
        filing_date: '2024-02-10'
      }),
      temperature_tag: 'DEAD',
      status: 'NEW',
      notes: 'Recent divorce filing. Property in excellent condition but may need to be sold as part of settlement.'
    },
    {
      address: '7654 E Shea Blvd, Scottsdale, AZ 85260',
      owner_name: 'Margaret Edwards',
      source_type: 'pre_foreclosure',
      source: 'foreclosure',
      motivation_score: 80,
      estimated_value: 610000,
      equity: 175000,
      condition_score: 88,
      tax_debt: 0,
      violations: 0,
      is_probate: false,
      is_vacant: false,
      lead_score: 85,
      aiScore: 82,
      phones: JSON.stringify(['(480) 555-6677']),
      emails: JSON.stringify(['m.edwards@example.com']),
      raw_data: JSON.stringify({
        months_behind: 4,
        auction_date: '2024-04-15',
        lender: 'First National Bank'
      }),
      temperature_tag: 'HOT',
      status: 'CONTACTED',
      notes: 'Pre-foreclosure, 4 months behind on payments. Auction scheduled. Owner interested in avoiding foreclosure.'
    }
  ];

  // Insert probate cases
  for (const probateCase of probateCases) {
    await prisma.probateCase.create({
      data: probateCase
    });
  }

  // Insert violations
  for (const violation of violations) {
    await prisma.propertyViolation.create({
      data: violation
    });
  }

  // Insert leads
  for (const lead of leads) {
    await prisma.lead.create({
      data: lead
    });
  }

  console.log('✅ Database seeded successfully!');
  console.log(`📊 Created: ${probateCases.length} probate cases, ${violations.length} violations, ${leads.length} leads`);
  
  // Display summary
  const leadCount = await prisma.lead.count();
  const probateCount = await prisma.probateCase.count();
  const violationCount = await prisma.propertyViolation.count();
  
  console.log('\n📈 Database Summary:');
  console.log(`🎯 Total Leads: ${leadCount}`);
  console.log(`⚖️ Probate Cases: ${probateCount}`);
  console.log(`🚨 Property Violations: ${violationCount}`);
  
  const totalValue = leads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
  console.log(`💰 Total Lead Value: $${totalValue.toLocaleString()}`);
}

seedDatabase()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
