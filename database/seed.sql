-- ROLE

INSERT INTO "ROLE" (role_name, permissions)
VALUES
('Admin', 'Full Access'),
('Staff', 'Limited Access');

-- USER

INSERT INTO "USER"
(role_id, email, password_hash, first_name, last_name, is_active)
VALUES
(1, 'admin@inventory.com', 'admin123', 'System', 'Admin', TRUE),

(2, 'staff1@inventory.com', 'staff123', 'John', 'Smith', TRUE),

(2, 'staff2@inventory.com', 'staff456', 'Sarah', 'Johnson', TRUE);

-- CUSTOMER

INSERT INTO "CUSTOMER"
(email, phone, first_name, last_name)
VALUES
('abir@gmail.com', '01711111111', 'Abir', 'Mahmud'),

('rahim@gmail.com', '01822222222', 'Rahim', 'Uddin'),

('karim@gmail.com', '01933333333', 'Karim', 'Hasan');

-- PRODUCT

INSERT INTO "PRODUCT"
(sku, title, retail_price, cost_price,
stock_quantity, low_stock_threshold, is_deleted)
VALUES

('SKU001','Wireless Mouse',850,600,50,10,FALSE),

('SKU002','Mechanical Keyboard',3500,2700,30,5,FALSE),

('SKU003','Gaming Headset',2500,1800,20,5,FALSE),

('SKU004','USB Flash Drive 64GB',900,650,100,20,FALSE),

('SKU005','27 Inch Monitor',25000,21000,10,2,FALSE);

-- SALES_TRANSACTION

INSERT INTO "SALES_TRANSACTION"
(user_id, customer_id, total_amount, total_cost)
VALUES
(2, 1, 4350.00, 3300.00),
(3, 2, 25000.00, 21000.00),
(2, 3, 900.00, 650.00);

-- Check transaction IDs
SELECT transaction_id FROM "SALES_TRANSACTION";

-- TRANSACTION_LINE_ITEM

INSERT INTO "TRANSACTION_LINE_ITEM"
(transaction_id, product_id, quantity, unit_price, unit_cost)
VALUES
(1, 1, 1, 850.00, 600.00),
(1, 2, 1, 3500.00, 2700.00),
(2, 5, 1, 25000.00, 21000.00),
(3, 4, 1, 900.00, 650.00);

-- AUDIT_LOG

INSERT INTO "AUDIT_LOG"
(user_id, action_type, description)
VALUES
(1, 'Login', 'Administrator logged in'),
(2, 'Product Update', 'Updated product stock'),
(3, 'Sales', 'Completed a sales transaction');

-- INVENTORY_LOG

INSERT INTO "INVENTORY_LOG"
(product_id, user_id, quantity_changed, reason)
VALUES
(1, 2, -1, 'Sale'),
(2, 2, -1, 'Sale'),
(5, 3, -1, 'Sale'),
(4, 2, -1, 'Sale'),
(1, 1, 50, 'Shipment');

-- AI_FORECAST

INSERT INTO "AI_FORECAST"
(product_id, forecast_month, predicted_sales_quantity, confidence_score)
VALUES
(1, '2026-08-01', 45, 0.92),
(2, '2026-08-01', 18, 0.89),
(3, '2026-08-01', 12, 0.84),
(4, '2026-08-01', 70, 0.95),
(5, '2026-08-01', 8, 0.81);

-- AI_REORDER_INSIGHT

INSERT INTO "AI_REORDER_INSIGHT"
(product_id, recommended_reorder_trigger, recommended_reorder_quantity, insight_summary)
VALUES
(1, 10, 50, 'Reorder before stock reaches 10 units'),
(2, 5, 20, 'Keyboard demand increasing'),
(3, 5, 15, 'Maintain minimum stock'),
(4, 20, 100, 'High sales volume expected'),
(5, 2, 10, 'Monitor monitor sales closely');