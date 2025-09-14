import axios from 'axios';

// Get API URL from environment variables or use default
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface Lead {
  id?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  ownerName?: string;
  phoneNumber?: string;
  email?: string;
  status: string;
  leadSource: string;
  estimatedValue?: number;
  lastSalePrice?: number;
  propertyType?: string;
  yearBuilt?: number;
  squareFeet?: number;
  bedrooms?: number;
  bathrooms?: number;
  notes?: string;
  tags?: string[];
  nextFollowUp?: string;
  lastContact?: string;
  createdAt?: string;
  updatedAt?: string;
  communication?: Communication[];
}

export interface Communication {
  id?: string;
  leadId: string;
  date: string;
  method: string; // phone, email, text, inperson, mail, other
  notes?: string;
  outcome?: string;
  createdAt?: string;
}

export interface LeadFilter {
  status?: string[];
  minValue?: number;
  maxValue?: number;
  city?: string;
  state?: string;
  zipCode?: string;
  leadSource?: string[];
  tags?: string[];
  createdAfter?: string;
  createdBefore?: string;
}

/**
 * Service for interacting with lead API endpoints
 */
export class LeadService {
  /**
   * Get all leads with optional filtering
   * 
   * @param filters Optional filters to apply
   * @returns List of leads
   */
  static async getLeads(filters: LeadFilter = {}): Promise<Lead[]> {
    try {
      const response = await axios.get(`${API_URL}/api/leads`, {
        params: filters
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching leads:', error);
      throw error;
    }
  }

  /**
   * Get a lead by ID
   * 
   * @param id Lead ID
   * @returns Lead details
   */
  static async getLeadById(id: string): Promise<Lead> {
    try {
      const response = await axios.get(`${API_URL}/api/leads/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching lead ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new lead
   * 
   * @param lead Lead data
   * @returns Created lead
   */
  static async createLead(lead: Lead): Promise<Lead> {
    try {
      const response = await axios.post(`${API_URL}/api/leads`, lead);
      return response.data;
    } catch (error) {
      console.error('Error creating lead:', error);
      throw error;
    }
  }

  /**
   * Update an existing lead
   * 
   * @param id Lead ID
   * @param lead Updated lead data
   * @returns Updated lead
   */
  static async updateLead(id: string, lead: Lead): Promise<Lead> {
    try {
      const response = await axios.put(`${API_URL}/api/leads/${id}`, lead);
      return response.data;
    } catch (error) {
      console.error(`Error updating lead ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a lead
   * 
   * @param id Lead ID
   */
  static async deleteLead(id: string): Promise<void> {
    try {
      await axios.delete(`${API_URL}/api/leads/${id}`);
    } catch (error) {
      console.error(`Error deleting lead ${id}:`, error);
      throw error;
    }
  }

  /**
   * Add communication to a lead
   * 
   * @param leadId Lead ID
   * @param communication Communication data
   * @returns Created communication
   */
  static async addCommunication(leadId: string, communication: Communication): Promise<Communication> {
    try {
      const response = await axios.post(
        `${API_URL}/api/leads/${leadId}/communications`, 
        communication
      );
      return response.data;
    } catch (error) {
      console.error('Error adding communication:', error);
      throw error;
    }
  }

  /**
   * Get communications for a lead
   * 
   * @param leadId Lead ID
   * @returns List of communications
   */
  static async getCommunications(leadId: string): Promise<Communication[]> {
    try {
      const response = await axios.get(
        `${API_URL}/api/leads/${leadId}/communications`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching communications:', error);
      throw error;
    }
  }

  /**
   * Get available lead statuses
   * 
   * @returns List of status values
   */
  static async getLeadStatuses(): Promise<string[]> {
    try {
      const response = await axios.get(`${API_URL}/api/leads/statuses`);
      return response.data;
    } catch (error) {
      console.error('Error fetching lead statuses:', error);
      return ['New', 'Contacted', 'Negotiating', 'Under Contract', 'Closed', 'Dead'];
    }
  }

  /**
   * Add a tag to a lead
   * 
   * @param leadId Lead ID
   * @param tag Tag to add
   * @returns Updated lead
   */
  static async addTagToLead(leadId: string, tag: string): Promise<Lead> {
    try {
      const response = await axios.post(
        `${API_URL}/api/leads/${leadId}/tags`,
        { tag }
      );
      return response.data;
    } catch (error) {
      console.error('Error adding tag:', error);
      throw error;
    }
  }

  /**
   * Remove a tag from a lead
   * 
   * @param leadId Lead ID
   * @param tag Tag to remove
   * @returns Updated lead
   */
  static async removeTagFromLead(leadId: string, tag: string): Promise<Lead> {
    try {
      const response = await axios.delete(
        `${API_URL}/api/leads/${leadId}/tags/${encodeURIComponent(tag)}`
      );
      return response.data;
    } catch (error) {
      console.error('Error removing tag:', error);
      throw error;
    }
  }

  /**
   * Get all available tags
   * 
   * @returns List of tags
   */
  static async getAvailableTags(): Promise<string[]> {
    try {
      const response = await axios.get(`${API_URL}/api/leads/tags`);
      return response.data;
    } catch (error) {
      console.error('Error fetching available tags:', error);
      return [];
    }
  }

  /**
   * Export leads to CSV format
   * 
   * @param leads Leads to export
   * @returns CSV content as string
   */
  static exportToCSV(leads: Lead[]): string {
    // Define the CSV headers
    const headers = [
      'Address',
      'City',
      'State',
      'ZIP',
      'Owner Name',
      'Phone',
      'Email',
      'Status',
      'Lead Source',
      'Estimated Value',
      'Last Sale Price',
      'Property Type',
      'Year Built',
      'Square Feet',
      'Bedrooms',
      'Bathrooms',
      'Notes',
      'Tags',
      'Next Follow-up',
      'Last Contact',
      'Created At'
    ];

    // Convert leads to CSV rows
    const rows = leads.map(lead => [
      lead.address,
      lead.city,
      lead.state,
      lead.zipCode,
      lead.ownerName || '',
      lead.phoneNumber || '',
      lead.email || '',
      lead.status,
      lead.leadSource,
      lead.estimatedValue ? `$${lead.estimatedValue}` : '',
      lead.lastSalePrice ? `$${lead.lastSalePrice}` : '',
      lead.propertyType || '',
      lead.yearBuilt || '',
      lead.squareFeet || '',
      lead.bedrooms || '',
      lead.bathrooms || '',
      lead.notes ? lead.notes.replace(/"/g, '""') : '',
      lead.tags ? lead.tags.join(', ') : '',
      lead.nextFollowUp ? new Date(lead.nextFollowUp).toLocaleDateString() : '',
      lead.lastContact ? new Date(lead.lastContact).toLocaleDateString() : '',
      lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : ''
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Download CSV content as a file
   * 
   * @param csvContent CSV content
   */
  static downloadCSV(csvContent: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Create a lead from a property
   * 
   * @param property Property data
   * @returns Lead object
   */
  static createLeadFromProperty(property: any): Lead {
    return {
      address: property.address.line1,
      city: property.address.locality,
      state: property.address.countrySubd,
      zipCode: property.address.postal1,
      ownerName: property.owner?.name || '',
      status: 'New',
      leadSource: 'Property Search',
      estimatedValue: property.assessment?.totalValue || property.sale?.saleAmt,
      lastSalePrice: property.sale?.saleAmt,
      propertyType: property.summary?.proptype,
      yearBuilt: property.building?.yearBuilt,
      squareFeet: property.building?.size?.bldgsize,
      bedrooms: property.building?.rooms?.beds,
      bathrooms: property.building?.rooms?.bathstotal,
      tags: [],
    };
  }
  
  /**
   * Submit feedback for a lead
   * 
   * @param leadId ID of the lead
   * @param label 'good' or 'bad' feedback
   * @returns Updated lead
   */
  static async submitFeedback(leadId: string, label: 'good' | 'bad'): Promise<any> {
    try {
      const response = await axios.post(`${API_URL}/api/leads/${leadId}/feedback`, { label });
      return response.data;
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }
  }

  /**
   * Score a lead using AI
   * 
   * @param leadId ID of the lead
   * @returns Updated lead with score and temperature
   */
  static async scoreLead(leadId: string): Promise<any> {
    try {
      const response = await axios.post(`${API_URL}/api/leads/${leadId}/score`);
      return response.data;
    } catch (error) {
      console.error('Error scoring lead:', error);
      throw error;
    }
  }

  /**
   * Skip trace a lead to find contact information
   * 
   * @param leadId ID of the lead
   * @returns Skip trace results with contact information
   */
  static async skipTraceLead(leadId: string): Promise<any> {
    try {
      const response = await axios.post(`${API_URL}/api/skip-trace/leads/${leadId}`);
      return response.data;
    } catch (error) {
      console.error('Error skip tracing lead:', error);
      throw error;
    }
  }

  /**
   * Get skip trace history for a lead
   * 
   * @param leadId ID of the lead
   * @returns Skip trace history
   */
  static async getSkipTraceHistory(leadId: string): Promise<any> {
    try {
      const response = await axios.get(`${API_URL}/api/skip-trace/leads/${leadId}/history`);
      return response.data;
    } catch (error) {
      console.error('Error getting skip trace history:', error);
      throw error;
    }
  }
}
