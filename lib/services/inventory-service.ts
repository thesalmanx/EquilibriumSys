import { InventoryItem } from '@/lib/types';

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? ''; // "" for same-origin dev

class InventoryService {
  private async request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const res = await fetch(input, {
      credentials: 'include', // 👈 Ensures session cookie is sent
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `(${res.status}) ${body || res.statusText || 'Request failed'}`
      );
    }

    return res.json();
  }

  /* -------------------- LIST -------------------- */
  async getList(params: {
    search?: string;
    category?: string | null;
    lowStock?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.category) q.set('category', params.category);
    if (params.lowStock) q.set('lowStock', 'true');
    if (params.limit) q.set('limit', String(params.limit));
    if (params.offset) q.set('offset', String(params.offset));

    const url = `${BASE}/api/inventory${q.toString() ? `?${q}` : ''}`;
    return this.request<{ items: InventoryItem[]; total: number }>(url);
  }

  /* -------------------- GET BY ID -------------------- */
  async getById(id: string) {
    return this.request<InventoryItem>(`${BASE}/api/inventory/${id}`);
  }

  /* -------------------- CREATE -------------------- */
  async create(data: Partial<InventoryItem>) {
    return this.request<InventoryItem>(`${BASE}/api/inventory`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /* -------------------- UPDATE -------------------- */
  async update(id: string, data: Partial<InventoryItem>) {
    return this.request<InventoryItem>(`${BASE}/api/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /* -------------------- DELETE -------------------- */
  async delete(id: string) {
    return this.request<InventoryItem>(`${BASE}/api/inventory/${id}`, {
      method: 'DELETE',
    });
  }

  /* -------------------- HISTORY (PER ITEM) -------------------- */
  async getHistory(
    itemId: string,
    params?: { limit?: number; offset?: number }
  ) {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));

    const url = `${BASE}/api/inventory/${itemId}/history${
      q.toString() ? `?${q}` : ''
    }`;
    return this.request(url);
  }

  /* -------------------- SAMPLE COMBINED HISTORY -------------------- */
  async getInventoryHistory(params?: { limit?: number; offset?: number }) {
    const inventory = await this.getList({ limit: 1 });
    if (inventory.items.length) {
      return this.getHistory(inventory.items[0].id, params);
    }
    return { history: [], total: 0 };
  }
}

export const inventoryService = new InventoryService();
