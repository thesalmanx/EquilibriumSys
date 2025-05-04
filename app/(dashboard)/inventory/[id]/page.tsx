'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Save, Trash2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InventoryHistory } from '@/components/inventory/inventory-history';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { inventoryService } from '@/lib/services/inventory-service';
import { InventoryItem } from '@/lib/types';

export default function InventoryItemPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    description: '',
    category: '',
    quantity: 0,
    reorderLevel: 0,
    cost: 0,
    price: 0,
    location: '',
    unit: ''
  });

  useEffect(() => {
    const fetchItem = async () => {
      try {
        if (params.id === 'new') {
          setItem(null);
          setIsEditing(true);
          setLoading(false);
          return;
        }
        
        const data = await inventoryService.getById(params.id);
        setItem(data);
        setForm({
          name: data.name,
          sku: data.sku,
          description: data.description || '',
          category: data.category || '',
          quantity: data.quantity,
          reorderLevel: data.reorderLevel,
          cost: data.cost,
          price: data.price,
          location: data.location || '',
          unit: data.unit || ''
        });
        setLoading(false);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load inventory item"
        });
        router.push('/inventory');
      }
    };

    fetchItem();
  }, [params.id, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'reorderLevel' || name === 'cost' || name === 'price'
        ? parseFloat(value) || 0
        : value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      if (params.id === 'new') {
        const newItem = await inventoryService.create(form);
        toast({
          title: "Success",
          description: "Item created successfully"
        });
        router.push(`/inventory/${newItem.id}`);
      } else {
        await inventoryService.update(params.id, form);
        const updated = await inventoryService.getById(params.id);
        setItem(updated);
        setIsEditing(false);
        toast({
          title: "Success",
          description: "Item updated successfully"
        });
      }
    } catch (error) {
      console.error('Save error:', error); // Add this!
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save inventory item"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await inventoryService.delete(params.id);
      toast({
        title: "Success",
        description: "Item deleted successfully"
      });
      router.push('/inventory');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete inventory item"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/inventory')}
          className="gap-2"
        >
          <ArrowLeft size={16} />
          Back to Inventory
        </Button>
        
        {item && !isEditing && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsEditing(true)}
              className="gap-2"
            >
              <Pencil size={16} />
              Edit
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 size={16} />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the
                    inventory item and remove it from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
        
        {isEditing && (
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              onClick={() => {
                if (params.id !== 'new') {
                  setIsEditing(false);
                  // Reset form to original values
                  if (item) {
                    setForm({
                      name: item.name,
                      sku: item.sku,
                      description: item.description || '',
                      category: item.category || '',
                      quantity: item.quantity,
                      reorderLevel: item.reorderLevel,
                      cost: item.cost,
                      price: item.price,
                      location: item.location || '',
                      unit: item.unit || ''
                    });
                  }
                } else {
                  router.push('/inventory');
                }
              }}
            >
              Cancel
            </Button>
            
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
              ) : (
                <Save size={16} />
              )}
              Save
            </Button>
          </div>
        )}
      </div>
      
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          {item && <TabsTrigger value="history">History</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>
                {params.id === 'new' ? 'Add New Item' : isEditing ? 'Edit Item' : item?.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Item Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="Enter item name"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    name="sku"
                    value={form.sku}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="Enter SKU"
                    required
                  />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="Enter description"
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    disabled={!isEditing}
                    value={form.category}
                    onValueChange={(value) => handleSelectChange('category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="electronics">Electronics</SelectItem>
                      <SelectItem value="clothing">Clothing</SelectItem>
                      <SelectItem value="food">Food & Beverages</SelectItem>
                      <SelectItem value="office">Office Supplies</SelectItem>
                      <SelectItem value="furniture">Furniture</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Select
                    disabled={!isEditing}
                    value={form.unit}
                    onValueChange={(value) => handleSelectChange('unit', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="each">Each</SelectItem>
                      <SelectItem value="kg">Kilogram (kg)</SelectItem>
                      <SelectItem value="g">Gram (g)</SelectItem>
                      <SelectItem value="l">Liter (L)</SelectItem>
                      <SelectItem value="ml">Milliliter (mL)</SelectItem>
                      <SelectItem value="box">Box</SelectItem>
                      <SelectItem value="pack">Pack</SelectItem>
                      <SelectItem value="pair">Pair</SelectItem>
                      <SelectItem value="set">Set</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Current Quantity</Label>
                  <Input
                    id="quantity"
                    name="quantity"
                    type="number"
                    value={form.quantity}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="0"
                    min="0"
                    step="1"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reorderLevel">Reorder Level</Label>
                  <Input
                    id="reorderLevel"
                    name="reorderLevel"
                    type="number"
                    value={form.reorderLevel}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="0"
                    min="0"
                    step="1"
                  />
                  {isEditing && (
                    <p className="text-xs text-muted-foreground">
                      System will alert when quantity falls below this level
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cost">Cost Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="cost"
                      name="cost"
                      type="number"
                      value={form.cost}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="pl-7"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="price">Selling Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      value={form.price}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="pl-7"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="location">Storage Location</Label>
                  <Input
                    id="location"
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="E.g., Warehouse A, Shelf B3"
                  />
                </div>
              </div>
              
              {!isEditing && item && item.quantity <= item.reorderLevel && (
                <div className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  <AlertTriangle size={16} />
                  <p className="text-sm">
                    This item is below the reorder threshold. Consider restocking soon.
                  </p>
                </div>
              )}
            </CardContent>
            
            {!isEditing && item && (
              <CardFooter className="flex justify-between text-sm text-muted-foreground">
                <div>Created: {new Date(item.createdAt).toLocaleString()}</div>
                <div>Last updated: {new Date(item.updatedAt).toLocaleString()}</div>
              </CardFooter>
            )}
          </Card>
        </TabsContent>
        
        {item && (
          <TabsContent value="history">
            <InventoryHistory itemId={params.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}