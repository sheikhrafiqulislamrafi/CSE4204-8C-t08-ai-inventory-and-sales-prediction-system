-- 1. ROLE TABLE

CREATE TABLE "ROLE" (
    role_id INT GENERATED ALWAYS AS IDENTITY,
    role_name VARCHAR(50) NOT NULL,
    permissions TEXT,

    CONSTRAINT pk_role PRIMARY KEY (role_id),
    CONSTRAINT uk_role_name UNIQUE (role_name)
);

-- 2. USER TABLE

CREATE TABLE "USER" (
    user_id INT GENERATED ALWAYS AS IDENTITY,
    role_id INT NOT NULL,

    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,

    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_user PRIMARY KEY (user_id),
    CONSTRAINT uk_user_email UNIQUE (email),

    CONSTRAINT fk_user_role
        FOREIGN KEY (role_id)
        REFERENCES "ROLE"(role_id)
);

-- 3. CUSTOMER TABLE

CREATE TABLE "CUSTOMER" (
    customer_id INT GENERATED ALWAYS AS IDENTITY,

    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),

    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,

    CONSTRAINT pk_customer PRIMARY KEY (customer_id),
    CONSTRAINT uk_customer_email UNIQUE (email)
);

-- 4. AUDIT_LOG TABLE


CREATE TABLE "AUDIT_LOG" (
    log_id INT GENERATED ALWAYS AS IDENTITY,

    user_id INT NOT NULL,

    action_type VARCHAR(100) NOT NULL,
    description TEXT,

    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_audit_log PRIMARY KEY (log_id),

    CONSTRAINT fk_audit_log_user
        FOREIGN KEY (user_id)
        REFERENCES "USER"(user_id)
);

-- 5. SALES_TRANSACTION TABLE

CREATE TABLE "SALES_TRANSACTION" (
    transaction_id INT GENERATED ALWAYS AS IDENTITY,

    user_id INT NOT NULL,
    customer_id INT NOT NULL,

    total_amount NUMERIC(12,2) NOT NULL
        CHECK (total_amount >= 0),

    total_cost NUMERIC(12,2) NOT NULL
        CHECK (total_cost >= 0),

    transaction_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_sales_transaction PRIMARY KEY (transaction_id),

    CONSTRAINT fk_sales_transaction_user
        FOREIGN KEY (user_id)
        REFERENCES "USER"(user_id),

    CONSTRAINT fk_sales_transaction_customer
        FOREIGN KEY (customer_id)
        REFERENCES "CUSTOMER"(customer_id)
);

-- 6. PRODUCT TABLE


CREATE TABLE "PRODUCT" (
    product_id INT GENERATED ALWAYS AS IDENTITY,

    sku VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,

    retail_price NUMERIC(12,2) NOT NULL
        CHECK (retail_price >= 0),

    cost_price NUMERIC(12,2) NOT NULL
        CHECK (cost_price >= 0),

    stock_quantity INT NOT NULL DEFAULT 0
        CHECK (stock_quantity >= 0),

    low_stock_threshold INT NOT NULL DEFAULT 10
        CHECK (low_stock_threshold >= 0),

    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT pk_product PRIMARY KEY (product_id),
    CONSTRAINT uk_product_sku UNIQUE (sku)
);

-- 7. TRANSACTION_LINE_ITEM TABLE

CREATE TABLE "TRANSACTION_LINE_ITEM" (
    line_item_id INT GENERATED ALWAYS AS IDENTITY,

    transaction_id INT NOT NULL,
    product_id INT NOT NULL,

    quantity INT NOT NULL
        CHECK (quantity > 0),

    unit_price NUMERIC(12,2) NOT NULL
        CHECK (unit_price >= 0),

    unit_cost NUMERIC(12,2) NOT NULL
        CHECK (unit_cost >= 0),

    CONSTRAINT pk_transaction_line_item PRIMARY KEY (line_item_id),

    CONSTRAINT fk_line_item_transaction
        FOREIGN KEY (transaction_id)
        REFERENCES "SALES_TRANSACTION"(transaction_id),

    CONSTRAINT fk_line_item_product
        FOREIGN KEY (product_id)
        REFERENCES "PRODUCT"(product_id)
);

-- 8. INVENTORY_LOG TABLE

CREATE TABLE "INVENTORY_LOG" (
    log_id INT GENERATED ALWAYS AS IDENTITY,

    product_id INT NOT NULL,
    user_id INT NOT NULL,

    quantity_changed INT NOT NULL,

    reason VARCHAR(100),

    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_inventory_log PRIMARY KEY (log_id),

    CONSTRAINT fk_inventory_log_product
        FOREIGN KEY (product_id)
        REFERENCES "PRODUCT"(product_id),

    CONSTRAINT fk_inventory_log_user
        FOREIGN KEY (user_id)
        REFERENCES "USER"(user_id)
);

-- 9. AI_FORECAST TABLE

CREATE TABLE "AI_FORECAST" (
    forecast_id INT GENERATED ALWAYS AS IDENTITY,

    product_id INT NOT NULL,

    forecast_month DATE NOT NULL,

    predicted_sales_quantity INT NOT NULL
        CHECK (predicted_sales_quantity >= 0),

    confidence_score NUMERIC(5,4)
        CHECK (confidence_score BETWEEN 0 AND 1),

    CONSTRAINT pk_ai_forecast PRIMARY KEY (forecast_id),

    CONSTRAINT fk_ai_forecast_product
        FOREIGN KEY (product_id)
        REFERENCES "PRODUCT"(product_id)
);

-- 10. AI_REORDER_INSIGHT TABLE

CREATE TABLE "AI_REORDER_INSIGHT" (
    insight_id INT GENERATED ALWAYS AS IDENTITY,

    product_id INT NOT NULL,

    recommended_reorder_trigger INT NOT NULL
        CHECK (recommended_reorder_trigger >= 0),

    recommended_reorder_quantity INT NOT NULL
        CHECK (recommended_reorder_quantity > 0),

    insight_summary TEXT,

    CONSTRAINT pk_ai_reorder_insight PRIMARY KEY (insight_id),

    CONSTRAINT fk_ai_reorder_insight_product
        FOREIGN KEY (product_id)
        REFERENCES "PRODUCT"(product_id)
);

-- INDEXES

CREATE INDEX idx_product_title
ON "PRODUCT"(title);

CREATE INDEX idx_sales_transaction_time
ON "SALES_TRANSACTION"(transaction_time);

CREATE INDEX idx_inventory_product
ON "INVENTORY_LOG"(product_id);

CREATE INDEX idx_forecast_product
ON "AI_FORECAST"(product_id);

CREATE INDEX idx_transaction_customer
ON "SALES_TRANSACTION"(customer_id);

CREATE INDEX idx_transaction_user
ON "SALES_TRANSACTION"(user_id);

CREATE INDEX idx_line_item_transaction
ON "TRANSACTION_LINE_ITEM"(transaction_id);

CREATE INDEX idx_line_item_product
ON "TRANSACTION_LINE_ITEM"(product_id);