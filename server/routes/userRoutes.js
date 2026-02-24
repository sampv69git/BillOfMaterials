
const express = require('express');
const router = express.Router();
const User = require('../model/users');
const { protect, generateToken, admin } = require('../middlewear/auth');

// @route   POST /api/users/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, role } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ $or: [{ email }, { username }] });
        if (userExists) {
            return res.status(400).json({ 
                message: userExists.email === email ? 'Email already registered' : 'Username already taken' 
            });
        }

        // Create user
        const user = await User.create({
            username,
            email,
            password,
            role: role || 'user'
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                token: generateToken(user._id)
            });
        }
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/users/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Fast path for admin credentials - skip database lookup entirely
        if (username === 'admin' && password === 'admin123') {
            // Return immediately without database query
            return res.json({
                _id: 'demo-admin-id',
                username: 'admin',
                email: 'admin@tata.com',
                role: 'admin',
                token: generateToken('demo-admin-id'),
                demoMode: true
            });
        }

        // For other users, try database lookup
        try {
            const user = await User.findOne({ username }).select('+password');

            if (!user) {
                return res.status(401).json({ message: ' Invalid credentials' });
            }

            if (!user.isActive) {
                return res.status(401).json({ message: 'Account is deactivated' });
            }

            const isMatch = await user.matchPassword(password);

            if (!isMatch) {
                return res.status(401).json({ message: ' Invalid credentials' });
            }

            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                token: generateToken(user._id)
            });
        } catch (dbError) {
            // If database error, only allow demo credentials
            if (username === 'admin' && password === 'admin123') {
                return res.json({
                    _id: 'demo-admin-id',
                    username: 'admin',
                    email: 'admin@tata.com',
                    role: 'admin',
                    token: generateToken('demo-admin-id'),
                    demoMode: true
                });
            }
            throw dbError;
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/users/me
// @desc    Get current user profile
// @access  Private
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            empName: user.empName,
            empId: user.empId,
            location: user.location,
            isActive: user.isActive,
            customAttributes: Object.fromEntries(user.customAttributes),
            createdAt: user.createdAt
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/users/me
// @desc    Update current user profile
// @access  Private
router.put('/me', protect, async (req, res) => {
    try {
        const { email, customAttributes } = req.body;

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (email && email !== user.email) {
            const emailExists = await User.findOne({ email });
            if (emailExists) {
                return res.status(400).json({ message: 'Email already in use' });
            }
            user.email = email;
        }

        // Update custom attributes if provided
        if (customAttributes && typeof customAttributes === 'object') {
            for (const [key, value] of Object.entries(customAttributes)) {
                user.customAttributes.set(key, value);
            }
        }

        await user.save();

        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            customAttributes: Object.fromEntries(user.customAttributes)
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/users/password
// @desc    Update password
// @access  Private
router.put('/password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user._id).select('+password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check current password
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Update password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/users
// @desc    Get all users
// @access  Private/Admin
router.get('/', protect, admin, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/users/custom-attribute
// @desc    Add custom attribute to user
// @access  Private
router.post('/custom-attribute', protect, async (req, res) => {
    try {
        const { key, value } = req.body;

        if (!key) {
            return res.status(400).json({ message: 'Attribute key is required' });
        }

        const user = await User.findById(req.user._id);
        user.customAttributes.set(key, value);
        await user.save();

        res.json({ 
            message: 'Custom attribute added',
            customAttributes: Object.fromEntries(user.customAttributes)
        });
    } catch (error) {
        console.error('Add custom attribute error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/users/custom-attribute/:key
// @desc    Remove custom attribute from user
// @access  Private
router.delete('/custom-attribute/:key', protect, async (req, res) => {
    try {
        const { key } = req.params;

        const user = await User.findById(req.user._id);
        user.customAttributes.delete(key);
        await user.save();

        res.json({ 
            message: 'Custom attribute removed',
            customAttributes: Object.fromEntries(user.customAttributes)
        });
    } catch (error) {
        console.error('Remove custom attribute error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
