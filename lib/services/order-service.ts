import { Order, OrderStatus } from '@/lib/types';

class OrderService {
  async getList(params: {
    search?: string;
    status?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    customerId?: string | null;
    limit?: number;
    offset?: number;
  }) {
    const queryParams = new URLSearchParams();
    
    if (params.search) queryParams.set('search', params.search);
    if (params.status) queryParams.set('status', params.status);
    if (params.startDate) queryParams.set('startDate', params.startDate);
    if (params.endDate) queryParams.set('endDate', params.endDate);
    if (params.customerId) queryParams.set('customerId', params.customerId);
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());
    
    const url = `/api/orders?${queryParams.toString()}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  }
  
  async getById(id: string) {
    try {
      const response = await fetch(`/api/orders/${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch order');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching order:', error);
      throw error;
    }
  }
  
  async create(data: {
    customerId: string;
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
    }>;
    notes?: string;
    discount?: number;
    tax?: number;
    paymentMethod?: string;
  }) {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create order');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }
  
  async updateStatus(id: string, status: OrderStatus, notes?: string) {
    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          notes,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update order status');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }
  
  async delete(id: string) {
    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete order');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error deleting order:', error);
      throw error;
    }
  }
  
  async sendReceipt(id: string) {
    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sendReceipt',
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send receipt');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error sending receipt:', error);
      throw error;
    }
  }
}

export const orderService = new OrderService();