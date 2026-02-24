const jwt = require('jsonwebtoken');
const User = require('../model/users');

// Check if we're in demo mode (no database)
const isDemoMode = !require('mongoose').connections[0]?.readyState;

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');

            // In demo mode, create a mock user
            if (isDemoMode) {
                req.user = {
                    _id: decoded.id || 'demo-user-id',
                    username: decoded.username || 'admin',
                    email: 'admin@example.com',
                    role: decoded.role || 'admin',
                    isActive: true
                };
                return next();
            }

            // Get user from token
            req.user = await User.findById(decoded.id);

            if (!req.user) {
                return res.status(401).json({ message: 'User not found' });
            }

            if (!req.user.isActive) {
                return res.status(401).json({ message: 'User account is deactivated' });
            }

            next();
        } catch (error) {
            // In demo mode, allow invalid tokens to pass through with mock user
            if (isDemoMode) {
                req.user = {
                    _id: 'demo-user-id',
                    username: 'admin',
                    email: 'admin@example.com',
                    role: 'admin',
                    isActive: true
                };
                return next();
            }
            console.error('Auth middleware error:', error);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else if (isDemoMode) {
        // In demo mode, allow requests without token
        req.user = {
            _id: 'demo-user-id',
            username: 'admin',
            email: 'admin@example.com',
            role: 'admin',
            isActive: true
        };
        return next();
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// Admin role check
const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as admin' });
    }
};

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'your-secret-key-change-in-production', {
        expiresIn: process.env.JWT_EXPIRE || '30d'
    });
};

module.exports = { protect, admin, generateToken };
