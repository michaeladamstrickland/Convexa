import { ProbateCase, PropertyViolation } from '../types';
interface CreateLeadData {
    address: string;
    owner_name?: string;
    phone?: string;
    email?: string;
    source_type: string;
    motivation_score?: number;
    estimated_value?: number;
    equity?: number;
    condition_score?: number;
    tax_debt?: number;
    violations?: number;
    is_probate?: boolean;
    is_vacant?: boolean;
    days_on_market?: number;
    notes?: string;
}
export declare class DatabaseService {
    private prisma;
    constructor();
    createLead(leadData: CreateLeadData): Promise<any>;
    getLeads(filters?: any): Promise<any[]>;
    getHighValueLeads(limit?: number): Promise<any[]>;
    getLeadByAddress(address: string): Promise<any | null>;
    updateLeadStatus(leadId: string, status: string, notes?: string): Promise<any>;
    createProbateCase(caseData: Partial<ProbateCase>): Promise<any>;
    getProbateCases(filters?: any): Promise<any[]>;
    createViolation(violationData: Partial<PropertyViolation>): Promise<any>;
    getViolations(filters?: any): Promise<any[]>;
    getLeadMetrics(): Promise<any>;
    getRevenueMetrics(): Promise<any>;
    private calculateBasicLeadScore;
    private calculateLeadScore;
    disconnect(): Promise<void>;
}
export {};
//# sourceMappingURL=databaseService.d.ts.map