/**
 * prompts.js — structured query prompts + deterministic fallback
 * Separated from ai_service.js so prompts can be edited independently.
 */

function _isBanglaQuestion(question) {
  return /[ঀ-৿]/.test(question || '');
}

function _formatContextValue(value) {
  if (value === null || value === undefined) return 'N/A';
  if (Array.isArray(value)) return value.length ? value.map(String).join('; ') : 'None';
  if (typeof value === 'object') return Object.entries(value).map(([k, v]) => k + ': ' + v).join('; ');
  return String(value);
}

function _formatReportContext(data) {
  const sections = {
    'Business Overview': {
      business_name: 'Business name',
      last_sale_date: 'Most recent sale date',
      data_gaps: 'Metrics not tracked in this system',
    },
    'Sales & Daily Performance': {
      total_orders: 'Total orders (all time)',
      delivered_orders: 'Delivered orders',
      pending_orders: 'Pending orders',
      returned_orders: 'Returned orders',
      cancelled_orders: 'Cancelled orders',
      return_rate_pct: 'Return rate (%)',
      total_revenue: 'Total revenue (BDT, all time)',
      total_profit: 'Total profit (BDT, all time)',
      total_delivery_cost: 'Total delivery cost (BDT, all time)',
      avg_order_value: 'Average order value (BDT, all time)',
      profit_margin_pct: 'Profit margin (%, all time)',
      net_cash_flow: 'Net cash flow after investments (BDT)',
      today_orders: "Today's orders",
      today_revenue: "Today's revenue / sales (BDT)",
      today_profit: "Today's profit (BDT)",
      last_7_days_orders: 'Orders in the last 7 days',
      last_7_days_revenue: 'Revenue in the last 7 days (BDT)',
      last_7_days_profit: 'Profit in the last 7 days (BDT)',
      top_products: 'Top selling products',
    },
    Customers: {
      unique_customers: 'Unique customers (all time)',
      at_risk_customers: 'At-risk customers (no purchase in 30+ days)',
      top_customers: 'Top customers by spend',
    },
    'Products & Inventory': {
      total_products_in_inventory: 'Products in inventory',
      total_stock_value: 'Inventory stock value (BDT)',
      out_of_stock_products: 'Out-of-stock products',
      low_stock_products: 'Low-stock products',
    },
    'Investments & Capital': {
      total_investment: 'Total investment spend (BDT)',
      investment_by_category: 'Investment breakdown by category',
    },
  };
  const lines = [];
  for (const [sectionName, labels] of Object.entries(sections)) {
    const sectionLines = [];
    for (const [key, label] of Object.entries(labels)) {
      if (key in data) sectionLines.push('- ' + label + ': ' + _formatContextValue(data[key]));
    }
    if (sectionLines.length) {
      lines.push('[' + sectionName + ']');
      lines.push(...sectionLines);
      lines.push('');
    }
  }
  return lines.join('\n').trim();
}

function _formatContextForPrompt(contextData) {
  return _formatReportContext(contextData);
}

function buildQueryPrompt(businessName, question, contextData) {
  const contextStr = _formatContextForPrompt(contextData || {});
  const q = (question || '').trim();
  return `You are an elite Business Analyst and Chief Strategy AI for ${businessName}.\nYou power "Ask Anything About Your Sales". Always deliver a structured executive briefing.\n\nDATA (use ONLY these facts - never invent numbers):\n${contextStr}\n\nRULES:\n- Cross-functional: link sales, customers, products/inventory, and investments in every answer.\n- Bold every key metric and BDT amount with ** (example: **BDT 17500**, **4 units**, **94%**).\n- For today's questions use today's fields; compare against last-7-days averages and all-time margin where relevant.\n- Proactively mention at-risk customers, out-of-stock, and low-stock items when the data supports it.\n- If CLV/CAC/churn are unavailable, note the gap briefly in The 'Why' section.\n\nLANGUAGE:\n- If the question is in Bangla: keep headings in English exactly as below, write all body text in Bangla. You may include English business terms in parentheses (Revenue, At-risk, AOV).\n- If the question is in English: write everything in English.\n\nREQUIRED FORMAT - always output exactly these three sections:\n\n**The Numbers**\n[2-4 sentences answering the question directly. Bold all figures.]\n\n**The 'Why'**\n[One analytical paragraph connecting today's performance to 7-day trends, profit margin vs overall margin (${(contextData && contextData.profit_margin_pct) || 'n/a'}%), inventory, and customer retention.]\n\n**Strategic Recommendation**\n[Exactly 2-3 numbered action items. For Bangla use 1. 2. 3. Each item starts with a **bold action title** followed by specific advice referencing real data from the dataset.]\n\nUser question: ${q}\n\nAnswer:`;
}

function _buildStructuredFallback(businessName, question, contextData) {
  const qLower = (question || '').toLowerCase();
  const todayRev = parseFloat(contextData.today_revenue || 0);
  const todayProfit = parseFloat(contextData.today_profit || 0);
  const todayOrders = parseInt(contextData.today_orders || 0, 10);
  const totalRev = parseFloat(contextData.total_revenue || 0);
  const totalProfit = parseFloat(contextData.total_profit || 0);
  const margin = parseFloat(contextData.profit_margin_pct || 0);
  const atRisk = parseInt(contextData.at_risk_customers || 0, 10);
  const unique = parseInt(contextData.unique_customers || 0, 10);
  const last7Rev = parseFloat(contextData.last_7_days_revenue || 0);
  const last7Orders = parseInt(contextData.last_7_days_orders || 0, 10);
  const avg7Day = last7Rev > 0 ? last7Rev / 7 : 0;
  const todayMargin = todayRev > 0 ? (todayProfit / todayRev * 100) : 0;
  const outOfStock = contextData.out_of_stock_products || 'None';
  const lowStock = contextData.low_stock_products || 'None';
  const bn = _isBanglaQuestion(question);

  let numbers = '';
  if (qLower.includes('profit') || qLower.includes('প্রফিট') || qLower.includes('লাভ')) {
    numbers = bn ? `Today's total profit **BDT ${todayProfit.toFixed(2)}**. All-time net profit **BDT ${totalProfit.toFixed(0)}**.` : `Today's total profit **BDT ${todayProfit.toFixed(2)}**. All-time net profit **BDT ${totalProfit.toFixed(0)}**.`;
  } else if (qLower.includes('revenue') || qLower.includes('রেভিনিউ') || qLower.includes('sales') || qLower.includes('সেলস') || qLower.includes('বিক্রি')) {
    numbers = bn ? `Today's total sales (Revenue) **BDT ${todayRev.toFixed(2)}**. Today's total orders **${todayOrders}** and profit **BDT ${todayProfit.toFixed(2)}**.` : `Today's revenue **BDT ${todayRev.toFixed(2)}** across **${todayOrders}** orders with **BDT ${todayProfit.toFixed(2)}** profit.`;
  } else if (qLower.includes('average order') || qLower.includes('aov') || qLower.includes('avg order') || qLower.includes('গড় অর্ডার')) {
    const aov = parseFloat(contextData.avg_order_value || 0);
    numbers = bn ? `Average order value (AOV) **BDT ${aov.toFixed(2)}**.` : `Average order value **BDT ${aov.toFixed(2)}**.`;
  } else if (qLower.includes('customer') || qLower.includes('কাস্টমার') || qLower.includes('গ্রাহক')) {
    numbers = bn ? `Total **${unique}** unique customers. **${atRisk}** at-risk (no purchase in 30+ days).` : `You have **${unique}** unique customers; **${atRisk}** are at-risk (no purchase in 30+ days).`;
  } else {
    numbers = bn ? `Today's sales **BDT ${todayRev.toFixed(2)}**, profit **BDT ${todayProfit.toFixed(2)}**, total orders **${todayOrders}**. All-time revenue **BDT ${totalRev.toFixed(0)}**, profit **BDT ${totalProfit.toFixed(0)}**.` : `Today: **BDT ${todayRev.toFixed(2)}** revenue, **BDT ${todayProfit.toFixed(2)}** profit, **${todayOrders}** orders. All-time: **BDT ${totalRev.toFixed(0)}** revenue, **BDT ${totalProfit.toFixed(0)}** profit.`;
  }

  const why = bn
    ? `Today's profit margin is approx **${todayMargin.toFixed(1)}%**, which is ${todayMargin > margin ? 'higher than' : 'lower than'} the overall average margin (**${margin.toFixed(1)}%**). Last 7-day average daily revenue **BDT ${avg7Day.toFixed(2)}** (${last7Orders} orders) - today's performance is ${todayRev >= avg7Day ? 'above' : 'below'} that.`
    : `Today's margin is **${todayMargin.toFixed(1)}%** vs overall **${margin.toFixed(1)}%**. 7-day daily revenue average is **BDT ${avg7Day.toFixed(2)}** (${last7Orders} orders) - today is ${todayRev >= avg7Day ? 'above' : 'below'} baseline.`;

  const recommendations = bn
    ? `1. **Inventory optimization:** Out-of-stock: ${outOfStock}. Restock quickly. 2. **Customer re-engagement:** **${atRisk}** at-risk customers (${unique} out of) - launch targeted offers. 3. **Low-stock alert:** Low-stock: ${lowStock} - replenish.`
    : `1. **Inventory optimization:** Restock out-of-stock items (${outOfStock}). 2. **Customer re-engagement:** **${atRisk}** of **${unique}** customers are at-risk - launch win-back offers. 3. **Low-stock alert:** Replenish low-stock items (${lowStock}).`;

  return '**The Numbers**\n' + numbers + '\n\n' + '**The \'Why\'**\n' + why + '\n\n' + '**Strategic Recommendation**\n' + recommendations;
}

module.exports = {
  buildQueryPrompt,
  _buildStructuredFallback,
  _formatContextForPrompt,
  _isBanglaQuestion,
};
