import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!reportType) {
      return NextResponse.json({ error: 'Report type is required' }, { status: 400 });
    }

    let startDateObj: Date;
    let endDateObj: Date;

    if (startDate) {
      startDateObj = new Date(startDate);
    } else {
      startDateObj = new Date();
      startDateObj.setDate(startDateObj.getDate() - 30);
    }

    if (endDate) {
      endDateObj = new Date(endDate);
      endDateObj.setDate(endDateObj.getDate() + 1);
    } else {
      endDateObj = new Date();
    }

    let reportData;

    switch (reportType) {
      case 'sales':
        reportData = await generateSalesReport(startDateObj, endDateObj);
        break;
      case 'inventory':
        reportData = await generateInventoryReport();
        break;
      case 'low-stock':
        reportData = await generateLowStockReport();
        break;
      case 'top-products':
        reportData = await generateTopProductsReport(startDateObj, endDateObj);
        break;
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }

    return NextResponse.json({
      type: reportType,
      startDate: startDateObj,
      endDate: new Date(endDateObj.getTime() - 1),
      data: reportData,
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// SALES REPORT
async function generateSalesReport(startDate: Date, endDate: Date) {
  const orders = await db.order.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
      status: {
        in: ['DELIVERED', 'COMPLETED', 'SHIPPED'],
      },
    },
    select: {
      id: true,
      total: true,
      status: true,
      createdAt: true,
    },
  });

  const totalSales = orders.reduce((sum, order) => sum + order.total, 0);

  const salesByDay: Record<string, { date: string; total: number; count: number }> = {};

  orders.forEach(order => {
    const date = order.createdAt.toISOString().split('T')[0];
    if (!salesByDay[date]) {
      salesByDay[date] = { date, total: 0, count: 0 };
    }
    salesByDay[date].total += order.total;
    salesByDay[date].count += 1;
  });

  const dailySales = Object.values(salesByDay).sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalSales,
    orderCount: orders.length,
    averageOrderValue: orders.length ? totalSales / orders.length : 0,
    dailySales,
  };
}

// INVENTORY REPORT
async function generateInventoryReport() {
  const items = await db.inventoryItem.findMany();

  const totalItems = items.length;
  const totalItemsQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalInventoryValueCost = items.reduce((sum, item) => sum + item.cost * item.quantity, 0);
  const totalInventoryValueRetail = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const potentialProfit = totalInventoryValueRetail - totalInventoryValueCost;
  const lowStockCount = items.filter(item => item.quantity <= item.reorderLevel).length;

  const categoryMap: Record<string, { count: number; quantity: number }> = {};

  for (const item of items) {
    const category = item.category || 'Uncategorized';
    if (!categoryMap[category]) {
      categoryMap[category] = { count: 0, quantity: 0 };
    }
    categoryMap[category].count++;
    categoryMap[category].quantity += item.quantity;
  }

  const categories = Object.entries(categoryMap).map(([category, data]) => ({
    category,
    count: data.count,
    quantity: data.quantity,
  }));

  return {
    totalItems,
    totalItemsQuantity,
    totalInventoryValueCost,
    totalInventoryValueRetail,
    potentialProfit,
    lowStockCount,
    categories,
  };
}

// LOW STOCK REPORT
async function generateLowStockReport() {
  const items = await db.inventoryItem.findMany();

  const lowStockItems = items.filter(item => item.quantity <= item.reorderLevel);
  const criticalItems = lowStockItems.filter(item => item.quantity === 0).length;
  const lowItems = lowStockItems.filter(item => item.quantity > 0 && item.quantity <= item.reorderLevel * 0.5).length;
  const warningItems = lowStockItems.filter(item => item.quantity > item.reorderLevel * 0.5).length;

  return {
    total: lowStockItems.length,
    criticalItems,
    lowItems,
    warningItems,
    items: lowStockItems,
  };
}

// TOP PRODUCTS REPORT
async function generateTopProductsReport(startDate: Date, endDate: Date) {
  const topProducts = await db.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: {
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
        status: {
          in: ['DELIVERED', 'COMPLETED', 'SHIPPED'],
        },
      },
    },
    _sum: {
      quantity: true,
      price: true,
    },
    orderBy: {
      _sum: {
        quantity: 'desc',
      },
    },
    take: 10,
  });

  const productIds = topProducts.map(p => p.productId);
  const products = await db.inventoryItem.findMany({
    where: {
      id: {
        in: productIds,
      },
    },
    select: {
      id: true,
      name: true,
      sku: true,
      category: true,
    },
  });

  return topProducts.map(product => {
    const details = products.find(p => p.id === product.productId) || {
      name: 'Unknown',
      sku: 'Unknown',
      category: 'Unknown',
    };
    return {
      ...details,
      quantitySold: product._sum.quantity || 0,
      totalRevenue: product._sum.price || 0,
    };
  });
}
