const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Register
const register = async (req, res) => {
    try {

        const { name, email, password } = req.body;

        // Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);

        res.status(201).json({
            success: true,
            message: "User Registered Successfully",
            data: {
                name,
                email,
                password: hashedPassword
            }
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

// Login
const login = async (req, res) => {

    try {

        const { email } = req.body;

        const token = jwt.sign(
            { email },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN
            }
        );

        res.status(200).json({
            success: true,
            message: "Login Successful",
            token
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// Protected Profile Route
const profile = (req, res) => {

    res.status(200).json({
        success: true,
        message: "Protected Profile Route",
        user: req.user
    });

};

module.exports = {
    register,
    login,
    profile
};