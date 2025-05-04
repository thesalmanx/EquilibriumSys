'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Printer, Clock, Package, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { OrderItemsTable } from '@/components/orders/order-items-table';
import { OrderStatusTimeline } from '@/components/orders/order-status-timeline';
import { toast } from '@/hooks/use-toast';
import { orderService } from '@/lib/services/order-service';
import { Order, OrderStatus } from '@/lib/types';

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        if (params.id === 'new') {
          router.push('/orders/create');
          return;
        }
        
        const data = await orderService.getById(params.id);
        setOrder(data);
        setLoading(false);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load order"
        });
        router.push('/orders');
      }
    };

    fetchOrder();
  }, [params.id, router]);

  const handleStatusUpdate = async (newStatus: OrderStatus) => {
    if (!order) return;
    
    try {
      setProcessingAction(true);
      await orderService.updateStatus(order.id, newStatus);
      
      // Refresh order data
      const updatedOrder = await orderService.getById(order.id);
      setOrder(updatedOrder);
      
      toast({
        title: "Success",
        description: `Order status updated to ${newStatus}`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update order status"
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleSendReceipt = async () => {
    if (!order) return;
    
    try {
      setProcessingAction(true);
      await orderService.sendReceipt(order.id);
      
      toast({
        title: "Success",
        description: "Receipt sent successfully"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send receipt"
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const handlePrintReceipt = () => {
    // Open print dialog
    window.print();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const getStatusBadgeVariant = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return 'secondary';
      case 'PROCESSING':
        return 'warning';
      case 'SHIPPED':
        return 'info';
      case 'DELIVERED':
        return 'success';
      case 'CANCELLED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/orders')}
          className="self-start gap-2"
        >
          <ArrowLeft size={16} />
          Back to Orders
        </Button>
        
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handlePrintReceipt}
            className="gap-2"
          >
            <Printer size={16} />
            Print Receipt
          </Button>
          
          <Button
            variant="outline"
            onClick={handleSendReceipt}
            disabled={processingAction}
            className="gap-2"
          >
            <Send size={16} />
            Email Receipt
          </Button>
          
          {order.status === 'PENDING' && (
            <Button 
              onClick={() => handleStatusUpdate('PROCESSING')}
              disabled={processingAction}
              className="gap-2"
            >
              <Clock size={16} />
              Start Processing
            </Button>
          )}
          
          {order.status === 'PROCESSING' && (
            <Button 
              onClick={() => handleStatusUpdate('SHIPPED')}
              disabled={processingAction}
              className="gap-2"
            >
              <Package size={16} />
              Mark as Shipped
            </Button>
          )}
          
          {order.status === 'SHIPPED' && (
            <Button 
              onClick={() => handleStatusUpdate('DELIVERED')}
              disabled={processingAction}
              className="gap-2"
            >
              <CheckCircle size={16} />
              Mark as Delivered
            </Button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-xl">Order #{order.orderNumber}</CardTitle>
                  <CardDescription>Placed on {new Date(order.createdAt).toLocaleDateString()}</CardDescription>
                </div>
                <Badge variant={getStatusBadgeVariant(order.status) as any}>
                  {order.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <OrderItemsTable items={order.items} />
              
              <div className="mt-6 space-y-2 rounded-md bg-muted p-4">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${order.subtotal.toFixed(2)}</span>
                </div>
                
                {order.tax > 0 && (
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>${order.tax.toFixed(2)}</span>
                  </div>
                )}
                
                {order.discount > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>Discount</span>
                    <span>-${order.discount.toFixed(2)}</span>
                  </div>
                )}
                
                <Separator className="my-2" />
                
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>${order.total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Order Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderStatusTimeline order={order} />
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">{order.customer.name}</h3>
                  <p className="text-sm text-muted-foreground">{order.customer.email}</p>
                  {order.customer.phone && (
                    <p className="text-sm text-muted-foreground">{order.customer.phone}</p>
                  )}
                </div>
                
                {order.customer.address && (
                  <div>
                    <p className="text-sm font-medium">Shipping Address</p>
                    <p className="text-sm text-muted-foreground">{order.customer.address.street}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.customer.address.city}, {order.customer.address.state} {order.customer.address.zipCode}
                    </p>
                    <p className="text-sm text-muted-foreground">{order.customer.address.country}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Method</span>
                  <span>{order.payment.method}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={order.payment.status === 'PAID' ? 'success' : 'warning'}>
                    {order.payment.status}
                  </Badge>
                </div>
                
                {order.payment.transactionId && (
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Transaction ID</span>
                    <span className="text-sm font-mono">{order.payment.transactionId}</span>
                  </div>
                )}
                
                {order.payment.date && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Date</span>
                    <span>{new Date(order.payment.date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {order.notes || 'No notes for this order.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}