class ReportService {
  async getSalesReport(startDate: Date, endDate: Date) {
    const queryParams = new URLSearchParams({
      type: 'sales',
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    });
    
    const url = `/api/reports?${queryParams.toString()}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch sales report');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching sales report:', error);
      throw error;
    }
  }
  
  async getInventoryReport() {
    const queryParams = new URLSearchParams({
      type: 'inventory',
    });
    
    const url = `/api/reports?${queryParams.toString()}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch inventory report');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching inventory report:', error);
      throw error;
    }
  }
  
  async getLowStockReport() {
    const queryParams = new URLSearchParams({
      type: 'low-stock',
    });
    
    const url = `/api/reports?${queryParams.toString()}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch low stock report');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching low stock report:', error);
      throw error;
    }
  }
  
  async getTopProductsReport(startDate: Date, endDate: Date) {
    const queryParams = new URLSearchParams({
      type: 'top-products',
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    });
    
    const url = `/api/reports?${queryParams.toString()}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch top products report');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching top products report:', error);
      throw error;
    }
  }
}

export const reportService = new ReportService();