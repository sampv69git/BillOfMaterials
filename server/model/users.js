
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 50
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6,
        select: false
    },
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user'
    },
    // Employee specific attributes
    empName: {
        type: String,
        trim: true,
        default: null
    },
    empId: {
        type: String,
        trim: true,
        default: null
    },
    location: {
        type: String,
        trim: true,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Flexible schema - users can add custom attributes
    customAttributes: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },
    // Track number of uploaded files (max 5)
    uploadedFileCount: {
        type: Number,
        default: 0
    },
    // Store the parent/main part number for BOM calculation
    parentPartNumber: {
        type: String,
        default: null
    },
    // Array to store references to uploaded BOM files
    uploadedFiles: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BOMFile'
    }]
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Add custom attribute
userSchema.methods.addCustomAttribute = function(key, value) {
    this.customAttributes.set(key, value);
    return this.save();
};

// Remove custom attribute
userSchema.methods.removeCustomAttribute = function(key) {
    this.customAttributes.delete(key);
    return this.save();
};

module.exports = mongoose.model('User', userSchema);
