export const mockProducts = [
  {
    id: 'PRD-001',
    name: 'UltraBook Pro 15" M2',
    sku: 'ELC-NB-109',
    category: 'Electronics',
    stock: 148,
    minStock: 30,
    price: 1299.00,
    warehouse: 'Main Central Hub',
    status: 'In Stock'
  },
  {
    id: 'PRD-002',
    name: 'Pro Wireless Earbuds Gen 2',
    sku: 'ELC-AU-302',
    category: 'Electronics',
    stock: 82,
    minStock: 25,
    price: 179.00,
    warehouse: 'West Coast Facility',
    status: 'In Stock'
  },
  {
    id: 'PRD-003',
    name: 'USB-C Fast Charging Hub 100W',
    sku: 'ACC-CH-441',
    category: 'Accessories',
    stock: 210,
    minStock: 50,
    price: 69.50,
    warehouse: 'South Fulfillment',
    status: 'In Stock'
  },
  {
    id: 'PRD-004',
    name: 'Precision Ergonomic Mouse',
    sku: 'ACC-PE-220',
    category: 'Accessories',
    stock: 65,
    minStock: 20,
    price: 89.00,
    warehouse: 'Main Central Hub',
    status: 'In Stock'
  },
  {
    id: 'PRD-005',
    name: 'Studio Monitor 27" 4K HDR',
    sku: 'ELC-MN-505',
    category: 'Electronics',
    stock: 18,
    minStock: 20,
    price: 499.00,
    warehouse: 'North Logistics Depot',
    status: 'Low Stock'
  },
  {
    id: 'PRD-006',
    name: 'Industrial Smart Sensor Hub v3',
    sku: 'IND-SN-012',
    category: 'Industrial',
    stock: 94,
    minStock: 15,
    price: 245.00,
    warehouse: 'North Logistics Depot',
    status: 'In Stock'
  },
  {
    id: 'PRD-007',
    name: 'Thermal Barcode Scanner Pro',
    sku: 'EQP-SC-889',
    category: 'Equipment',
    stock: 12,
    minStock: 15,
    price: 320.00,
    warehouse: 'Main Central Hub',
    status: 'Low Stock'
  },
  {
    id: 'PRD-008',
    name: 'High-Vis Warehouse Vest (L)',
    sku: 'APP-WF-008',
    category: 'Apparel',
    stock: 450,
    minStock: 100,
    price: 24.00,
    warehouse: 'South Fulfillment',
    status: 'In Stock'
  }
];

export const mockWarehouses = [
  { id: 'WHS-01', name: 'Main Central Hub', code: 'HUB-MUM-01', location: 'Hyderabad Central Logistics Park', capacity: '88%', totalItems: 124500, activeManagers: 8 },
  { id: 'WHS-02', name: 'North Logistics Depot', code: 'DEP-DEL-02', location: 'Secunderabad Industrial Zone', capacity: '72%', totalItems: 84200, activeManagers: 5 },
  { id: 'WHS-03', name: 'South Fulfillment Center', code: 'FUL-BLR-03', location: 'Gachibowli Gateway Area', capacity: '91%', totalItems: 61850, activeManagers: 4 },
  { id: 'WHS-04', name: 'West Coast Facility', code: 'FAC-BOM-04', location: 'Kukatpally Depot Complex', capacity: '45%', totalItems: 14000, activeManagers: 2 }
];
