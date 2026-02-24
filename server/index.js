const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');
const User = require('./model/users');

// Import routes
const userRoutes = require('./routes/userRoutes');
const bomRoutes = require('./routes/bomRoutes');

// Initialize express
const app = express();

// Connect to MongoDB and create default admin user
const initDB = async () => {
    const dbConnected = await connectDB();
    if (dbConnected) {
        // Create default admin user if not exists
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            await User.create({
                username: 'admin',
                email: 'admin@tata.com',
                password: 'admin123',
                role: 'admin',
                isActive: true
            });
            console.log('Default admin user created (admin/admin123)');
        } else {
            console.log('Admin user already exists');
        }
    }
};

initDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files from frontend folder
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'BOM Calculator API is running' });
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/bom', bomRoutes);

// Serve frontend index.html for root and all frontend routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Serve index.html for any frontend route (SPA support)
app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API Base URL: http://localhost:${PORT}/api`);
});

module.exports = app;
