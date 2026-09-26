// Daily Inbound vs Outbound inventory activity
export const mockActivityData = [
  { day: 'Mon', inbound: 145, outbound: 98, total: 243 },
  { day: 'Tue', inbound: 110, outbound: 135, total: 245 },
  { day: 'Wed', inbound: 185, outbound: 120, total: 305 },
  { day: 'Thu', inbound: 130, outbound: 160, total: 290 },
  { day: 'Fri', inbound: 210, outbound: 175, total: 385 },
  { day: 'Sat', inbound: 95, outbound: 80, total: 175 },
  { day: 'Sun', inbound: 65, outbound: 45, total: 110 }
];

// Stock Movement Timeline (Units in 1,000s)
export const mockStockMovement = [
  { time: '08:00', stock: 268, capacity: 320, optimal: 280 },
  { time: '10:00', stock: 274, capacity: 320, optimal: 280 },
  { time: '12:00', stock: 269, capacity: 320, optimal: 280 },
  { time: '14:00', stock: 281, capacity: 320, optimal: 280 },
  { time: '16:00', stock: 286, capacity: 320, optimal: 280 },
  { time: '18:00', stock: 283, capacity: 320, optimal: 280 },
  { time: '20:00', stock: 284, capacity: 320, optimal: 280 }
];

// Category Breakdown Distribution
export const mockCategoryData = [
  { name: 'Electronics & Computing', percentage: 42, count: 6224, color: '#2563eb' },
  { name: 'Apparel & Uniforms', percentage: 28, count: 4149, color: '#059669' },
  { name: 'Home & Industrial Living', percentage: 18, count: 2668, color: '#f59e0b' },
  { name: 'Hardware & Accessories', percentage: 12, count: 1779, color: '#6366f1' }
];

// Fast Moving Products
export const mockFastMovingProducts = [
  { id: 'PRD-01', name: 'UltraBook Pro 15"', sku: 'ELC-NB-109', velocity: '94%', unitsMoved: 642, stockLevel: 148, trend: '+14%' },
  { id: 'PRD-02', name: 'Pro Wireless Earbuds', sku: 'ELC-AU-302', velocity: '88%', unitsMoved: 518, stockLevel: 82, trend: '+9%' },
  { id: 'PRD-03', name: 'USB-C Fast Charging Hub', sku: 'ACC-CH-441', velocity: '82%', unitsMoved: 467, stockLevel: 210, trend: '+18%' },
  { id: 'PRD-04', name: 'Precision Ergonomic Mouse', sku: 'ACC-PE-220', velocity: '79%', unitsMoved: 395, stockLevel: 65, trend: '+6%' },
  { id: 'PRD-05', name: 'Studio Monitor 27" 4K', sku: 'ELC-MN-505', velocity: '71%', unitsMoved: 284, stockLevel: 34, trend: '+11%' },
  { id: 'PRD-06', name: 'Industrial Smart Sensor Hub', sku: 'IND-SN-012', velocity: '65%', unitsMoved: 219, stockLevel: 94, trend: '+4%' }
];

// Long-Term Performance Metrics (6 Months)
export const mockPerformanceData = [
  { month: 'Jan', turnover: 4.8, fulfillment: 96.2, accuracy: 99.1, volume: 18400 },
  { month: 'Feb', turnover: 5.1, fulfillment: 97.4, accuracy: 99.3, volume: 20100 },
  { month: 'Mar', turnover: 4.9, fulfillment: 95.8, accuracy: 98.9, volume: 19800 },
  { month: 'Apr', turnover: 5.4, fulfillment: 98.1, accuracy: 99.5, volume: 22600 },
  { month: 'May', turnover: 5.8, fulfillment: 98.7, accuracy: 99.6, volume: 24800 },
  { month: 'Jun', turnover: 6.2, fulfillment: 99.2, accuracy: 99.8, volume: 27300 }
];
