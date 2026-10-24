/**
 * Upload Middleware - Excel / CSV parsing with column mapping
 */

const multer = require('multer');
const Papa = require('papaparse');
const xlsx = require('xlsx');

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

function parseCSV(buffer, mappingFn) {
  const text = buffer.toString('utf-8');
  const result = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true });
  if (result.errors.length > 0) throw new Error(`CSV parse error: ${result.errors[0].message}`);
  return result.data.map(row => mappingFn(row));
}

function parseExcel(buffer, mappingFn) {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(firstSheet, { raw: false, defval: '' });
  return rows.map(row => mappingFn(row));
}


function mapOrderRow(row) {
  const phoneVal = row['Customer Phone'] || row['CustomerPhone'] || row.customer_phone || '';
  const nameVal = row['Customer Name'] || row['CustomerName'] || row.customer_name || '';
  const prodVal = row['Product Name'] || row['ProductName'] || row.product || row.product_name || '';
  const prodIdVal = row['Product ID'] || row['ProductId'] || row['SKU'] || row.sku || row.product_id || '';
  const statusVal = row.Status || row.status || 'delivered';
  const notesVal = row.Notes || row.notes || '';

  return {
    date: row.Date || row.date,
    order_id: row['Order ID'] || row['OrderId'] || row.order_id || row['Order ID '],
    consignment_id: row['Consignment ID'] || row['ConsignmentId'] || row.consignment_id,
    customer_name: String(nameVal).replace(/^Name: /, '').trim(),
    customer_phone: String(phoneVal).trim(),
    product_name: String(prodVal).trim(),
    product_id: String(prodIdVal).trim(),
    quantity: parseInt(row.Quantity || row.quantity || row.Qty || 1) || 1,
    amount: parseFloat((row.Amount || row.amount || '0').toString().replace(/[৳,\s]/g, '')) || 0,
    delivery_cost: parseFloat((row['Delivery Cost'] || row['DeliveryCost'] || row.delivery_cost || '0').toString().replace(/[৳,\s]/g, '')) || 0,
    product_cost: parseFloat((row['Product Cost'] || row['ProductCost'] || row.product_cost || row['Cost'] || row.Cost || '0').toString().replace(/[৳,\s]/g, '')) || 0,
    status: String(statusVal).trim().toLowerCase(),
    notes: String(notesVal).trim()
  };
}


function mapProductRow(row) {
  return {
    name: String(row.Name || row.name || '').trim(),
    sku: String(row.SKU || row.sku || '').trim() || null,
    category: String(row.Category || row.category || '').trim() || null,
    supplier: String(row.Supplier || row.supplier || '').trim() || null,
    unit_cost: parseFloat((row['Unit Cost'] || row['UnitCost'] || row.unit_cost || '0').toString().replace(/[৳,\s]/g, '')) || 0,
    sell_price: parseFloat((row['Sell Price'] || row['SellPrice'] || row.sell_price || '0').toString().replace(/[৳,\s]/g, '')) || 0,
    current_stock: parseInt((row['Current Stock'] || row['CurrentStock'] || row.current_stock || row.Stock || row.stock || '0').toString().replace(/[৳,\s]/g, '')) || 0,
    reorder_level: parseInt((row['Reorder Level'] || row['ReorderLevel'] || row.reorder_level || '0').toString().replace(/[৳,\s]/g, '')) || 0,
    notes: String(row.Notes || row.notes || '').trim()
  };
}


function mapInvestmentRow(row) {
  return {
    date: row.Date || row.date,
    category: String(row.Category || row.category || '').trim() || 'Other',
    amount: parseFloat((row.Amount || row.amount || '0').toString().replace(/[৳,\s]/g, '')) || 0,
    notes: String(row.Notes || row.notes || row['Notes / Quantity'] || '').trim()
  };
}

function isExcelFile(buffer) {
  if (!buffer || buffer.length < 4) return false;

  const sig = buffer.toString('ascii', 0, 2);
  return sig === 'PK';
}

function parseOrdersExcel(buffer, originalname) {
  if (isExcelFile(buffer)) {
    return parseExcel(buffer, mapOrderRow);
  }
  return parseCSV(buffer, mapOrderRow);
}

function parseProductsExcel(buffer, originalname) {
  if (isExcelFile(buffer)) {
    return parseExcel(buffer, mapProductRow);
  }
  return parseCSV(buffer, mapProductRow);
}

function parseInvestmentsExcel(buffer, originalname) {
  if (isExcelFile(buffer)) {
    return parseExcel(buffer, mapInvestmentRow);
  }
  return parseCSV(buffer, mapInvestmentRow);
}

module.exports = {
  upload,
  parseOrdersCSV: (buffer) => parseCSV(buffer, mapOrderRow),
  parseProductsCSV: (buffer) => parseCSV(buffer, mapProductRow),
  parseInvestmentsCSV: (buffer) => parseCSV(buffer, mapInvestmentRow),
  parseOrdersExcel,
  parseProductsExcel,
  parseInvestmentsExcel
};
