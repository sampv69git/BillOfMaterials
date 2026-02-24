
const mongoose = require('mongoose');

const bomItemSchema = new mongoose.Schema({
    item: {
        type: String,
        required: true,
        index: true
    },
    itemDescription: {
        type: String,
        default: ''
    },
    quantity: {
        type: Number,
        default: 1
    },
    partType: {
        type: String,
        default: ''
    },
    currency: {
        type: String,
        default: 'INR'
    },
    unitPrice: {
        type: Number,
        default: 0
    },
    totalPrice: {
        type: Number,
        default: 0
    },
    // Parent-child relationship for BOM hierarchy
    parentItem: {
        type: String,
        default: null
    },
    level: {
        type: Number,
        default: 0
    },
    // Flexible schema - users can add custom attributes dynamically
    customAttributes: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Calculate total price before saving
bomItemSchema.pre('save', function(next) {
    this.totalPrice = this.quantity * this.unitPrice;
    next();
});

// Add custom attribute
bomItemSchema.methods.addCustomAttribute = function(key, value) {
    this.customAttributes.set(key, value);
    return this.save();
};

// Remove custom attribute
bomItemSchema.methods.removeCustomAttribute = function(key) {
    this.customAttributes.delete(key);
    return this.save();
};

// Get all custom attribute names
bomItemSchema.methods.getCustomAttributeNames = function() {
    return Array.from(this.customAttributes.keys());
};

const bomFileSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true
    },
    originalName: {
        type: String,
        required: true
    },
    mimeType: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    path: {
        type: String,
        required: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Store the Excel data as JSON in MongoDB for flexibility
    bomData: [{
        type: Map,
        of: mongoose.Schema.Types.Mixed
    }],
    // Store column headers to know what attributes are available
    columnHeaders: [{
        type: String
    }],
    // Number of rows in the file
    rowCount: {
        type: Number,
        default: 0
    },
    // File status
    status: {
        type: String,
        enum: ['pending', 'processed', 'error'],
        default: 'pending'
    },
    // Flexible schema - users can add custom attributes for the file itself
    customAttributes: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },
    // Mark this file as the parent/main file for BOM calculation
    isParent: {
        type: Boolean,
        default: false
    },
    // Store the parent/main part number from this file
    parentPartNumber: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Add custom attribute
bomFileSchema.methods.addCustomAttribute = function(key, value) {
    this.customAttributes.set(key, value);
    return this.save();
};

const BOMFile = mongoose.model('BOMFile', bomFileSchema);
const BOMItem = mongoose.model('BOMItem', bomItemSchema);

module.exports = {
    BOMFile,
    BOMItem
};
