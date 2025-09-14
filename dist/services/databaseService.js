"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const client_1 = require("@prisma/client");
class DatabaseService {
    constructor() {
        this.prisma = new client_1.PrismaClient();
    }
    // Lead Management
    async createLead(leadData) {
        return await this.prisma.lead.create({
            data: {
                address: leadData.address || '',
                owner_name: leadData.owner_name || '',
                phone: leadData.phone || null,
                email: leadData.email || null,
                source_type: leadData.source_type || 'manual',
                motivation_score: leadData.motivation_score || 0,
                estimated_value: leadData.estimated_value || 0,
                equity: leadData.equity || 0,
                condition_score: leadData.condition_score || 50,
                tax_debt: leadData.tax_debt || 0,
                violations: leadData.violations || 0,
                is_probate: leadData.is_probate || false,
                is_vacant: leadData.is_vacant || false,
                days_on_market: leadData.days_on_market || null,
                lead_score: this.calculateBasicLeadScore(leadData),
                status: 'new',
                notes: leadData.notes || null
            }
        });
    }
    async getLeads(filters) {
        const where = {};
        if (filters?.source)
            where.source_type = filters.source;
        if (filters?.minScore)
            where.lead_score = { gte: filters.minScore };
        if (filters?.status)
            where.status = filters.status;
        if (filters?.is_probate !== undefined)
            where.is_probate = filters.is_probate;
        return await this.prisma.lead.findMany({
            where,
            orderBy: { lead_score: 'desc' }
        });
    }
    async getHighValueLeads(limit = 50) {
        return await this.prisma.lead.findMany({
            where: {
                lead_score: { gte: 70 }
            },
            orderBy: { lead_score: 'desc' },
            take: limit
        });
    }
    async getLeadByAddress(address) {
        return await this.prisma.lead.findFirst({
            where: {
                address: {
                    contains: address
                }
            }
        });
    }
    async updateLeadStatus(leadId, status, notes) {
        return await this.prisma.lead.update({
            where: { id: leadId },
            data: {
                status,
                notes: notes ? notes : undefined,
                updated_at: new Date()
            }
        });
    }
    // Probate Case Management
    async createProbateCase(caseData) {
        return await this.prisma.probateCase.create({
            data: {
                case_number: caseData.case_number || '',
                deceased_name: caseData.deceased_name || '',
                filing_date: caseData.filing_date || new Date(),
                case_status: caseData.case_status || 'filed',
                county: caseData.county || '',
                estimated_estate_value: caseData.estimated_estate_value || 0,
                properties_json: caseData.properties ? JSON.stringify(caseData.properties) : null,
                heirs_json: caseData.heir_contacts ? JSON.stringify(caseData.heir_contacts) : null,
                urgency_score: caseData.urgency_score || 0,
                deal_potential_score: caseData.deal_potential_score || 0,
                next_hearing_date: caseData.next_hearing_date || null,
                attorney_name: caseData.attorney_info?.name || null,
                attorney_phone: caseData.attorney_info?.phone || null
            }
        });
    }
    async getProbateCases(filters) {
        const where = {};
        if (filters?.county)
            where.county = filters.county;
        if (filters?.status)
            where.case_status = filters.status;
        if (filters?.minValue)
            where.estimated_estate_value = { gte: filters.minValue };
        return await this.prisma.probateCase.findMany({
            where,
            orderBy: { deal_potential_score: 'desc' }
        });
    }
    // Property Violation Management
    async createViolation(violationData) {
        return await this.prisma.propertyViolation.create({
            data: {
                property_address: violationData.property_address || '',
                violation_type: violationData.violation_type || '',
                severity_score: violationData.severity_score || 0,
                repeat_offender: violationData.repeat_offender || false,
                financial_burden: violationData.financial_burden || 0,
                compliance_deadline: violationData.compliance_deadline || new Date(),
                enforcement_stage: violationData.enforcement_stage || 'notice',
                deal_potential: violationData.deal_potential || 0
            }
        });
    }
    async getViolations(filters) {
        const where = {};
        if (filters?.type)
            where.violation_type = filters.type;
        if (filters?.minSeverity)
            where.severity_score = { gte: filters.minSeverity };
        if (filters?.stage)
            where.enforcement_stage = filters.stage;
        return await this.prisma.propertyViolation.findMany({
            where,
            orderBy: { deal_potential: 'desc' }
        });
    }
    // Analytics & Metrics
    async getLeadMetrics() {
        const totalLeads = await this.prisma.lead.count();
        const probateLeads = await this.prisma.lead.count({ where: { is_probate: true } });
        const highValueLeads = await this.prisma.lead.count({ where: { lead_score: { gte: 80 } } });
        const qualifiedLeads = await this.prisma.lead.count({
            where: { status: { in: ['qualified', 'hot', 'contacted'] } }
        });
        const avgLeadScore = await this.prisma.lead.aggregate({
            _avg: { lead_score: true }
        });
        const totalEstimatedValue = await this.prisma.lead.aggregate({
            _sum: { estimated_value: true }
        });
        const leadsBySource = await this.prisma.lead.groupBy({
            by: ['source_type'],
            _count: { id: true }
        });
        const leadsByStatus = await this.prisma.lead.groupBy({
            by: ['status'],
            _count: { id: true }
        });
        return {
            total_leads: totalLeads,
            probate_leads: probateLeads,
            high_value_leads: highValueLeads,
            qualified_leads: qualifiedLeads,
            average_lead_score: avgLeadScore._avg.lead_score || 0,
            total_estimated_value: totalEstimatedValue._sum.estimated_value || 0,
            leads_by_source: leadsBySource,
            leads_by_status: leadsByStatus
        };
    }
    async getRevenueMetrics() {
        const metrics = await this.getLeadMetrics();
        // Calculate potential revenue based on conversion rates
        const estimatedMonthlyRevenue = (metrics.qualified_leads * 0.05) * 2500; // 5% conversion, $2500 per deal
        const leadSalesRevenue = metrics.high_value_leads * 75; // $75 per high-value lead sale
        return {
            ...metrics,
            estimated_monthly_revenue: estimatedMonthlyRevenue,
            lead_sales_revenue: leadSalesRevenue,
            total_potential_revenue: estimatedMonthlyRevenue + leadSalesRevenue
        };
    }
    // Utility Methods
    calculateBasicLeadScore(leadData) {
        let score = 0;
        // Base score from motivation
        score += (leadData.motivation_score || 0) * 0.3;
        // Property value influence
        const value = leadData.estimated_value || 0;
        if (value > 500000)
            score += 25;
        else if (value > 300000)
            score += 15;
        else if (value > 200000)
            score += 10;
        // Equity influence
        const equity = leadData.equity || 0;
        if (equity > 200000)
            score += 20;
        else if (equity > 100000)
            score += 15;
        else if (equity > 50000)
            score += 10;
        // Distress indicators
        if (leadData.is_probate)
            score += 25;
        if (leadData.tax_debt && leadData.tax_debt > 10000)
            score += 15;
        if (leadData.violations && leadData.violations > 0)
            score += 10;
        // Source type bonus
        if (leadData.source_type === 'probate_intelligence')
            score += 15;
        if (leadData.source_type === 'tax_delinquency')
            score += 20;
        if (leadData.source_type === 'pre_foreclosure')
            score += 25;
        return Math.min(Math.max(score, 0), 100);
    }
    calculateLeadScore(leadData) {
        let score = 0;
        // Property value influence
        const value = leadData.estimated_value || 0;
        if (value > 500000)
            score += 25;
        else if (value > 300000)
            score += 15;
        else if (value > 200000)
            score += 10;
        // Distress indicators
        if (leadData.is_probate)
            score += 25;
        if (leadData.tax_debt && leadData.tax_debt > 10000)
            score += 15;
        if (leadData.violations && leadData.violations.length > 0)
            score += 10;
        if (leadData.vacancy_months && leadData.vacancy_months > 3)
            score += 10;
        // Condition penalty
        const condition = leadData.condition_score || 50;
        if (condition < 30)
            score += 15; // Very distressed = opportunity
        else if (condition > 80)
            score -= 5; // Too good condition
        return Math.min(Math.max(score, 0), 100);
    }
    async disconnect() {
        await this.prisma.$disconnect();
    }
}
exports.DatabaseService = DatabaseService;
//# sourceMappingURL=databaseService.js.map