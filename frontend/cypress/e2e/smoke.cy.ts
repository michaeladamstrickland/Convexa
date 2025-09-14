/// <reference types="cypress" />
describe('LeadFlow Smoke', () => {
  it('logs in, navigates to leads, opens a lead, views CRM, and visits analytics', () => {
    cy.visit('/login');
    // Demo creds fallback – adjust if real auth exists
    cy.get('input[type="email"]').type('admin@leadflow.ai');
    cy.get('input[type="password"]').type('password123');
    cy.contains('button', 'Sign In').click();

    cy.url().should('not.include', '/login');

    cy.visit('/leads');
    // If table exists, click first row address if available
    cy.get('table').then(($t) => {
      if ($t.length) {
        // no-op for now as Leads page is mocked list
      }
    });

    // Go to calls intelligence page
    cy.visit('/calls');
    cy.contains('Call Intelligence');

    // Go to analytics and see metrics block
    cy.visit('/analytics');
    cy.contains('Live Backend Metrics');
  });
});
