import api from '../api/client';

export interface SavedSearch {
  id: string;
  name: string;
  description: string;
  filters: any;
  createdAt: string;
  lastRun: string;
  resultCount: number;
  isFavorite: boolean;
}

export interface SavedSearchCreateParams {
  name: string;
  description?: string;
  filters: any;
}

export class SavedSearchesAPI {
  // Get all saved searches
  static async getSavedSearches(): Promise<SavedSearch[]> {
    try {
  const response = await api.get(`/saved-searches`);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch saved searches');
      }
      
      return response.data.searches || [];
    } catch (error: any) {
      console.error('Error fetching saved searches:', error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to fetch saved searches'
      );
    }
  }
  
  // Get a specific saved search by ID
  static async getSavedSearch(searchId: string): Promise<SavedSearch> {
    try {
  const response = await api.get(`/saved-searches/${searchId}`);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch saved search');
      }
      
      return response.data.search;
    } catch (error: any) {
      console.error(`Error fetching saved search ${searchId}:`, error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to fetch saved search'
      );
    }
  }
  
  // Create a new saved search
  static async createSavedSearch(searchData: SavedSearchCreateParams): Promise<SavedSearch> {
    try {
  const response = await api.post(`/saved-searches`, searchData);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create saved search');
      }
      
      return response.data.search;
    } catch (error: any) {
      console.error('Error creating saved search:', error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to create saved search'
      );
    }
  }
  
  // Update an existing saved search
  static async updateSavedSearch(searchId: string, searchData: Partial<SavedSearchCreateParams>): Promise<SavedSearch> {
    try {
  const response = await api.put(`/saved-searches/${searchId}`, searchData);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to update saved search');
      }
      
      return response.data.search;
    } catch (error: any) {
      console.error(`Error updating saved search ${searchId}:`, error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to update saved search'
      );
    }
  }
  
  // Delete a saved search
  static async deleteSavedSearch(searchId: string): Promise<void> {
    try {
  const response = await api.delete(`/saved-searches/${searchId}`);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to delete saved search');
      }
    } catch (error: any) {
      console.error(`Error deleting saved search ${searchId}:`, error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to delete saved search'
      );
    }
  }
  
  // Toggle favorite status
  static async toggleFavoriteStatus(searchId: string, isFavorite: boolean): Promise<SavedSearch> {
    try {
  const response = await api.patch(`/saved-searches/${searchId}/favorite`, { isFavorite });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to update favorite status');
      }
      
      return response.data.search;
    } catch (error: any) {
      console.error(`Error updating favorite status for search ${searchId}:`, error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to update favorite status'
      );
    }
  }
  
  // Execute a saved search
  static async executeSavedSearch(searchId: string): Promise<any> {
    try {
  const response = await api.post(`/saved-searches/${searchId}/execute`);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to execute saved search');
      }
      
      return response.data.results;
    } catch (error: any) {
      console.error(`Error executing saved search ${searchId}:`, error);
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to execute saved search'
      );
    }
  }
}

export default SavedSearchesAPI;
