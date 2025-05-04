'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Filter, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useOrderFilters } from '@/hooks/use-order-filters';

export function OrdersHeader() {
  const router = useRouter();
  const { filters, setFilters } = useOrderFilters();
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const [date, setDate] = useState<Date | undefined>(
    filters.startDate ? new Date(filters.startDate) : undefined
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ ...filters, search: searchInput });
  };

  const handleStatusFilter = (status: string | null) => {
    setFilters({ ...filters, status });
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate) {
      // Format date as ISO string but only keep the date part
      const dateStr = selectedDate.toISOString().split('T')[0];
      setFilters({ ...filters, startDate: dateStr, endDate: dateStr });
    } else {
      setFilters({ ...filters, startDate: null, endDate: null });
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">
          Manage customer orders and process sales
        </p>
      </div>
      
      <div className="flex flex-col gap-2 sm:flex-row">
        <form onSubmit={handleSearchSubmit} className="w-full sm:w-auto">
          <div className="relative">
            <Input
              placeholder="Search orders..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full"
            />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0"
            >
              <span className="sr-only">Search</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </Button>
          </div>
        </form>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal w-full sm:w-auto",
                !date && "text-muted-foreground"
              )}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {date ? format(date, 'PPP') : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarComponent
              mode="single"
              selected={date}
              onSelect={handleDateSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full gap-2 sm:w-auto">
              <Filter className="h-4 w-4" />
              <span>Filter</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Filter By Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => handleStatusFilter(null)}>
                <span className={!filters.status ? 'text-primary' : ''}>
                  All Statuses
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusFilter('PENDING')}>
                <span className={filters.status === 'PENDING' ? 'text-primary' : ''}>
                  Pending
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusFilter('PROCESSING')}>
                <span className={filters.status === 'PROCESSING' ? 'text-primary' : ''}>
                  Processing
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusFilter('SHIPPED')}>
                <span className={filters.status === 'SHIPPED' ? 'text-primary' : ''}>
                  Shipped
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusFilter('DELIVERED')}>
                <span className={filters.status === 'DELIVERED' ? 'text-primary' : ''}>
                  Delivered
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusFilter('CANCELLED')}>
                <span className={filters.status === 'CANCELLED' ? 'text-primary' : ''}>
                  Cancelled
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Button 
          onClick={() => router.push('/orders/create')}
          className="w-full gap-2 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          <span>New Order</span>
        </Button>
      </div>
    </div>
  );
}