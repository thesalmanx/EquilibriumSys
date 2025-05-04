'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash, Package, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CustomerSelect } from '@/components/orders/customer-select';
import { ProductSelect } from '@/components/orders/product-select';
import { toast } from '@/hooks/use-toast';
import { inventoryService } from '@/lib/services/inventory-service';
import { orderService } from '@/lib/services/order-service';
import { InventoryItem, Customer } from '@/lib/types';

interface OrderItem {
  productId: string;
  product: InventoryItem | null;
  quantity: number;
  price: number;
}

export default function CreateOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([{ 
    productId: '', 
    product: null, 
    quantity: 1, 
    price: 0 
  }]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CREDIT_CARD');
  const [discount, setDiscount] = useState<number>(0);

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    // Apply discount if any
    return subtotal - (discount || 0);
  };

  const handleProductSelect = async (productId: string, index: number) => {
    try {
      if (!productId) {
        const updatedItems = [...items];
        updatedItems[index] = { ...updatedItems[index], product: null, price: 0 };
        setItems(updatedItems);
        return;
      }
      
      const product = await inventoryService.getById(productId);
      const updatedItems = [...items];
      updatedItems[index] = { 
        ...updatedItems[index], 
        productId,
        product, 
        price: product.price 
      };
      setItems(updatedItems);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load product details"
      });
    }
  };

  const handleQuantityChange = (value: number, index: number) => {
    if (value < 1) value = 1;
    
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], quantity: value };
    setItems(updatedItems);
  };

  const handlePriceChange = (value: number, index: number) => {
    if (value < 0) value = 0;
    
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], price: value };
    setItems(updatedItems);
  };

  const addItem = () => {
    setItems([...items, { productId: '', product: null, quantity: 1, price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      toast({
        title: "Cannot Remove",
        description: "Order must have at least one item",
        variant: "destructive"
      });
      return;
    }
    
    const updatedItems = items.filter((_, i) => i !== index);
    setItems(updatedItems);
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedCustomer) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a customer"
      });
      return;
    }
    
    const invalidItems = items.some(item => !item.productId || !item.product);
    if (invalidItems) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select products for all order items"
      });
      return;
    }
    
    try {
      setSubmitting(true);
      
      const orderData = {
        customerId: selectedCustomer.id,
        items: items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        })),
        notes,
        discount,
        paymentMethod
      };
      
      const newOrder = await orderService.create(orderData);
      
      toast({
        title: "Success",
        description: `Order #${newOrder.orderNumber} created`
      });
      
      router.push(`/orders/${newOrder.id}`);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create order"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button 
        variant="ghost" 
        onClick={() => router.push('/orders')}
        className="gap-2"
      >
        <ArrowLeft size={16} />
        Back to Orders
      </Button>
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package size={18} />
                Order Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="space-y-4 rounded-lg border p-4">
                  <div className="flex justify-between">
                    <h4 className="font-medium">Item {index + 1}</h4>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                    >
                      <Trash size={16} className="text-destructive" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`product-${index}`}>Product</Label>
                      <ProductSelect
                        id={`product-${index}`}
                        value={item.productId}
                        onSelect={(productId) => handleProductSelect(productId, index)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                      <Input
                        id={`quantity-${index}`}
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1, index)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`price-${index}`}>Unit Price</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          $
                        </span>
                        <Input
                          id={`price-${index}`}
                          type="number"
                          className="pl-7"
                          step="0.01"
                          min="0"
                          value={item.price}
                          onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0, index)}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Total</Label>
                      <div className="flex h-10 items-center rounded-md border bg-muted/50 px-3">
                        ${(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              <Button 
                variant="outline" 
                onClick={addItem}
                className="mt-2 w-full gap-2"
              >
                <Plus size={16} />
                Add Another Item
              </Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart size={18} />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment-method">Payment Method</Label>
                <Select 
                  value={paymentMethod} 
                  onValueChange={setPaymentMethod}
                >
                  <SelectTrigger id="payment-method">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="CHECK">Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="discount">Discount Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="discount"
                    type="number"
                    className="pl-7"
                    step="0.01"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Order Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add notes about this order..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerSelect 
                value={selectedCustomer?.id || ''} 
                onSelect={(customer) => setSelectedCustomer(customer)}
              />
              
              {selectedCustomer && (
                <div className="mt-4 space-y-2">
                  <div className="text-sm text-muted-foreground">
                    {selectedCustomer.email}
                  </div>
                  {selectedCustomer.phone && (
                    <div className="text-sm text-muted-foreground">
                      {selectedCustomer.phone}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${calculateSubtotal().toFixed(2)}</span>
                </div>
                
                {discount > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>Discount</span>
                    <span>-${discount.toFixed(2)}</span>
                  </div>
                )}
                
                <Separator />
                
                <div className="flex justify-between text-lg font-medium">
                  <span>Total</span>
                  <span>${calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full gap-2" 
                size="lg"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                ) : (
                  <ShoppingCart size={16} />
                )}
                Create Order
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}