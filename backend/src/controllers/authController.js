const register = async (req, res) => {

    res.status(201).json({
        success: true,
        message: "User Registration API"
    });

};

const login = async (req, res) => {

    res.status(200).json({
        success: true,
        message: "User Login API"
    });

};

module.exports = {
    register,
    login
};