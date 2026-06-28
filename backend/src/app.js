const express = require("express");
const cors = require("cors");

const routes = require("./routes");
const logger = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Built-in Middleware
app.use(cors());
app.use(express.json());

// Custom Logger Middleware
app.use(logger);

// Root Route
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Backend Working"
    });
});

// API Routes
app.use("/api/v1", routes);

// Error Handling Middleware (Always Keep It Last)
app.use(errorHandler);

module.exports = app;