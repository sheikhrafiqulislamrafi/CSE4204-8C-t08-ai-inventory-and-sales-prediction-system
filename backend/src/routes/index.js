const express = require("express");

const router = express.Router();

const authRoutes = require("./authRoutes");

router.get("/", (req, res) => {

    res.status(200).json({
        success: true,
        message: "AI Inventory & Sales Prediction API is running"
    });

});

router.use("/auth", authRoutes);

module.exports = router;