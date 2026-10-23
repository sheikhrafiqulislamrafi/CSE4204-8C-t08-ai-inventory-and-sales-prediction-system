/**
 * Shared helpers — mirrors the Python reference implementation exactly.
 */


function roundMoney(value) {
  const n = parseFloat(value || 0);
  if (!isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}


function round1(value) {
  const n = parseFloat(value || 0);
  if (!isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 10) / 10;
}


function normalizeText(value) {
  return (value || '').trim().toLowerCase();
}

const CANCELLED_STATUSES = ['cancelled', 'canceled', 'returned'];


function isCancelledStatus(status) {
  return CANCELLED_STATUSES.includes(normalizeText(status));
}

/**
 * Sign used for financial totals:
 *  -1 for cancelled / canceled / returned, +1 otherwise.
 */
function orderSign(status) {
  return isCancelledStatus(status) ? -1 : 1;
}


function isStockConsumingStatus(status) {
  return !isCancelledStatus(status);
}


function computeProfit(amount, deliveryCost, productCost = 0) {
  return roundMoney((parseFloat(amount) || 0) - (parseFloat(productCost) || 0));
}


function cleanAmount(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/[৳,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isFinite(parsed) ? parsed : 0;
}


function cleanDate(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().split('T')[0];
  }

  if (typeof value === 'number' && isFinite(value)) {

    const excelEpoch = Date.UTC(1899, 11, 30);
    const ms = excelEpoch + value * 86400000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return null;
  }

  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === 'nan') return null;


  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, mo, d] = isoMatch;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }


  const slashMatch = raw.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (slashMatch) {
    const [, a, b, y] = slashMatch;
    const day = parseInt(a, 10);
    const month = parseInt(b, 10);

    if (day > 12) {
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];

  return null;
}


function todayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}


function daysAgoString(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}


function daysSince(dateStr) {
  if (!dateStr) return 0;
  const s = String(dateStr).slice(0, 10);
  const parsed = new Date(`${s}T00:00:00`);
  if (isNaN(parsed.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - parsed.getTime()) / 86400000);
  return diff < 0 ? 0 : diff;
}

/**
 * Customer aggregation — the exact shape produced by the Python
 * `_customer_aggregates` helper.
 */
function customerAggregates(orders, inactiveDays = 30) {
  const customers = new Map();

  for (const order of orders) {
    const key = (order.customer_phone || order.customer_name || `order-${order.id}`).trim();
    if (!customers.has(key)) {
      customers.set(key, {
        phone: '',
        name: '',
        first_order: '',
        last_order: '',
        total_orders: 0,
        total_revenue: 0,
        categories: new Map(),
        timeline: []
      });
    }
    const row = customers.get(key);
    row.phone = order.customer_phone || row.phone;
    row.name = order.customer_name || row.name || order.customer_phone || 'Unknown';
    row.total_orders += 1;

    if (order.product_name) {
      const lower = String(order.product_name).toLowerCase();
      const cat = ['monitor', 'hub', 'ssd', 'hdd', 'router'].some(x => lower.includes(x))
        ? 'Electronics'
        : 'Accessories';
      row.categories.set(cat, (row.categories.get(cat) || 0) + 1);
    }

    const sign = orderSign(order.status);
    row.total_revenue += sign * (parseFloat(order.amount) || 0);

    if (order.date) {
      if (!row.first_order || order.date < row.first_order) row.first_order = order.date;
      if (!row.last_order || order.date > row.last_order) row.last_order = order.date;
      row.timeline.push({
        date: order.date,
        product: order.product_name,
        amount: roundMoney(order.amount || 0),
        status: order.status
      });
    }
  }

  const rows = [];
  for (const row of customers.values()) {
    const ordersCount = row.total_orders;
    const revenue = row.total_revenue;
    const daysSinceLast = daysSince(row.last_order);
    const isAtRisk = daysSinceLast > inactiveDays;

    let segment;
    if (isAtRisk) segment = 'At-Risk';
    else if (revenue > 5000) segment = 'VIP';
    else if (ordersCount >= 3) segment = 'Loyal';
    else segment = 'New';

    let favoriteCategory = 'Unknown';
    let best = -1;
    for (const [cat, count] of row.categories) {
      if (count > best) { best = count; favoriteCategory = cat; }
    }

    row.timeline.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    rows.push({
      phone: row.phone,
      name: row.name,
      first_order: row.first_order,
      last_order: row.last_order,
      total_orders: row.total_orders,
      total_revenue: roundMoney(revenue),
      avg_order: ordersCount ? roundMoney(revenue / ordersCount) : 0,
      days_since_last_order: daysSinceLast,
      is_at_risk: isAtRisk,
      segment,
      favorite_category: favoriteCategory,
      timeline: row.timeline.slice(0, 15)
    });
  }

  return rows.sort((a, b) => b.total_revenue - a.total_revenue);
}


function dailyAggregates(orders) {
  const daily = new Map();
  for (const order of orders) {
    if (!order.date) continue;
    if (!daily.has(order.date)) {
      daily.set(order.date, { orders: 0, revenue: 0, delivery_cost: 0, profit: 0 });
    }
    const day = daily.get(order.date);
    day.orders += 1;
    const sign = orderSign(order.status);
    day.revenue += sign * ((parseFloat(order.amount) || 0) + (parseFloat(order.delivery_cost) || 0));
    day.delivery_cost += sign * (parseFloat(order.delivery_cost) || 0);
    day.profit += sign * (parseFloat(order.profit) || 0);
  }

  return [...daily.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, v]) => ({
      date,
      orders: v.orders,
      revenue: roundMoney(v.revenue),
      delivery_cost: roundMoney(v.delivery_cost),
      profit: roundMoney(v.profit),
      average_order: v.orders ? roundMoney(v.revenue / v.orders) : 0
    }));
}


function productStatus(product) {
  const stock = parseInt(product.current_stock || 0);
  const reorder = parseInt(product.reorder_level || 0);
  if (stock <= 0) return 'Out of Stock';
  if (stock <= reorder) return 'Low Stock';
  return 'In Stock';
}


function productToDict(product) {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    supplier: product.supplier,
    unit_cost: roundMoney(product.unit_cost),
    sell_price: roundMoney(product.sell_price),
    current_stock: parseInt(product.current_stock || 0),
    reorder_level: parseInt(product.reorder_level || 0),
    status: productStatus(product),
    notes: product.notes,
    created_at: product.created_at ? new Date(product.created_at).toISOString() : null,
    updated_at: product.updated_at ? new Date(product.updated_at).toISOString() : null
  };
}


function investmentToDict(item) {
  return {
    id: item.id,
    date: item.date,
    category: item.category,
    amount: roundMoney(item.amount),
    notes: item.notes,
    notes_quantity: item.notes,
    created_at: item.created_at ? new Date(item.created_at).toISOString() : null,
    updated_at: item.updated_at ? new Date(item.updated_at).toISOString() : null
  };
}


function orderToDict(order) {
  return {
    id: order.id,
    owner_id: order.owner_id,
    date: order.date,
    consignment_id: order.consignment_id,
    order_id: order.order_id,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    product_name: order.product_name,
    product_id: order.product_id,
    quantity: parseInt(order.quantity || 1),
    amount: parseFloat(order.amount || 0),
    delivery_cost: parseFloat(order.delivery_cost || 0),
    product_cost: parseFloat(order.product_cost || 0),
    profit: parseFloat(order.profit || 0),
    status: order.status,
    notes: order.notes,
    created_at: order.created_at ? new Date(order.created_at).toISOString() : null,
    updated_at: order.updated_at ? new Date(order.updated_at).toISOString() : null
  };
}

module.exports = {
  roundMoney,
  round1,
  normalizeText,
  isCancelledStatus,
  orderSign,
  isStockConsumingStatus,
  computeProfit,
  cleanAmount,
  cleanDate,
  todayString,
  daysAgoString,
  daysSince,
  customerAggregates,
  dailyAggregates,
  productStatus,
  productToDict,
  investmentToDict,
  orderToDict,
  CANCELLED_STATUSES
};
