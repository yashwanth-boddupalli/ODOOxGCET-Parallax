export const mockKpis = [
  {
    id: 'total-products',
    label: 'Total Products',
    value: '14,820',
    numericValue: 14820,
    change: '+8.4%',
    isPositive: true,
    timeframe: 'vs last month',
    badge: '18 Active Categories',
    icon: 'Package',
    color: 'blue'
  },
  {
    id: 'stock-available',
    label: 'Stock Available',
    value: '284,550',
    numericValue: 284550,
    change: '+12.1%',
    isPositive: true,
    timeframe: 'vs last month',
    badge: '94.2% In-Stock Rate',
    icon: 'Boxes',
    color: 'emerald'
  },
  {
    id: 'pending-orders',
    label: 'Pending Orders',
    value: '38',
    numericValue: 38,
    change: '-5.2%',
    isPositive: true, // Decreasing pending orders is positive
    timeframe: 'vs last week',
    badge: '14 Ready for Dispatch',
    icon: 'Truck',
    color: 'indigo'
  },
  {
    id: 'low-stock',
    label: 'Low Stock Items',
    value: '17',
    numericValue: 17,
    change: '+3 items',
    isPositive: false,
    timeframe: 'requires reorder',
    badge: '5 Critical Threshold',
    icon: 'AlertTriangle',
    color: 'amber'
  }
];
