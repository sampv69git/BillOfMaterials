const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { BOMFile, BOMItem } = require('../model/BOM');
const { protect } = require('../middlewear/auth');
const upload = require('../middlewear/upload');
const User = require('../model/users');

// Maximum files allowed per user
const MAX_FILES_PER_USER = 5;

// Required columns for BOM calculation
const REQUIRED_BOM_COLUMNS = ['Item', 'Item Description', 'Quantity', 'Part Type', 'Currency'];

// Helper function to check for required columns (case-insensitive)
function getMissingColumns(headers) {
    const missingColumns = [];
    const headersLower = headers.map(h => h.toLowerCase().trim());
    
    for (const requiredCol of REQUIRED_BOM_COLUMNS) {
        const requiredLower = requiredCol.toLowerCase();
        if (!headersLower.includes(requiredLower)) {
            missingColumns.push(requiredCol);
        }
    }
    return missingColumns;
}

// Helper function to find the actual column name (case-insensitive)
function findColumn(headers, requiredCol) {
    const requiredLower = requiredCol.toLowerCase();
    return headers.find(h => h.toLowerCase().trim() === requiredLower);
}

// @route   POST /api/bom/upload
// @desc    Upload BOM Excel file
// @access  Private
router.post('/upload', protect, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Read the Excel file
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const bomData = XLSX.utils.sheet_to_json(worksheet);
        
        if (bomData.length === 0) {
            // Delete the uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'No data found in the file' });
        }

        // Get column headers from the first row
        const columnHeaders = Object.keys(bomData[0]);
        
        // Check for missing required columns
        const missingColumns = getMissingColumns(columnHeaders);
        
        // If all columns are missing, return special response
        if (missingColumns.length === REQUIRED_BOM_COLUMNS.length) {
            // Delete the uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(200).json({
                message: 'No required columns found in the file',
                hasRequiredColumns: false,
                missingColumns: missingColumns,
                availableColumns: columnHeaders
            });
        }
        
        // If some columns are missing, return them for user to fill
        if (missingColumns.length > 0) {
            return res.status(200).json({
                message: 'Some required columns are missing',
                hasRequiredColumns: false,
                missingColumns: missingColumns,
                availableColumns: columnHeaders
            });
        }

        // Create BOMFile record
        const bomFile = await BOMFile.create({
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            path: req.file.path,
            uploadedBy: req.user._id,
            bomData: bomData,
            columnHeaders: columnHeaders,
            rowCount: bomData.length,
            status: 'processed'
        });

        // Also save individual BOM items for easier querying
        for (const item of bomData) {
            await BOMItem.create({
                item: item.Item || item['Part Number'] || item['Material ID'] || 'Unknown',
                itemDescription: item['Item Description'] || item.Description || '',
                quantity: parseFloat(item.Quantity || item.qty || 1),
                partType: item['Part Type'] || item['PartType'] || '',
                currency: item.Currency || 'INR',
                unitPrice: parseFloat(item['Unit Price'] || item['unitPrice'] || item.Price || 0),
                customAttributes: item
            });
        }

        res.status(201).json({
            message: 'File uploaded successfully',
            file: {
                _id: bomFile._id,
                originalName: bomFile.originalName,
                rowCount: bomFile.rowCount,
                columnHeaders: bomFile.columnHeaders,
                createdAt: bomFile.createdAt
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        // Delete uploaded file if there's an error
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (err) {
                console.error('Error deleting file:', err);
            }
        }
        res.status(500).json({ message: 'Server error during file upload' });
    }
});

// @route   POST /api/bom/save-with-missing
// @desc    Save BOM data with manually entered missing attributes
// @access  Private
router.post('/save-with-missing', protect, async (req, res) => {
    try {
        const { fileData, missingAttributes, originalFileName } = req.body;
        
        if (!fileData || !Array.isArray(fileData) || fileData.length === 0) {
            return res.status(400).json({ message: 'No data provided' });
        }

        const columnHeaders = Object.keys(fileData[0]);

        const bomFile = await BOMFile.create({
            filename: `bom_${Date.now()}.xlsx`,
            originalName: originalFileName || 'uploaded_bom.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            size: 0,
            path: '',
            uploadedBy: req.user._id,
            bomData: fileData,
            columnHeaders: columnHeaders,
            rowCount: fileData.length,
            status: 'processed'
        });

        for (const item of fileData) {
            await BOMItem.create({
                item: item.Item || item['Part Number'] || item['Material ID'] || 'Unknown',
                itemDescription: item['Item Description'] || item.Description || '',
                quantity: parseFloat(item.Quantity || item.qty || 1),
                partType: item['Part Type'] || item['PartType'] || '',
                currency: item.Currency || 'INR',
                unitPrice: parseFloat(item['Unit Price'] || item['unitPrice'] || item.Price || 0),
                customAttributes: item
            });
        }

        res.status(201).json({
            message: 'BOM data saved successfully',
            fileId: bomFile._id,
            rowCount: fileData.length
        });
    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/bom/files
// @desc    Get all uploaded BOM files
// @access  Private
router.get('/files', protect, async (req, res) => {
    try {
        const files = await BOMFile.find({ uploadedBy: req.user._id })
            .sort({ createdAt: -1 })
            .select('-bomData -path');
        
        res.json(files);
    } catch (error) {
        console.error('Get files error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/bom/files/:id
// @desc    Get specific BOM file data
// @access  Private
router.get('/files/:id', protect, async (req, res) => {
    try {
        const file = await BOMFile.findById(req.params.id);
        
        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        res.json(file);
    } catch (error) {
        console.error('Get file error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/bom/files/:id
// @desc    Delete a BOM file
// @access  Private
router.delete('/files/:id', protect, async (req, res) => {
    try {
        const file = await BOMFile.findById(req.params.id);
        
        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Delete the physical file
        if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }

        // Delete associated BOM items
        await BOMItem.deleteMany({});

        await file.deleteOne();

        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/bom/item/:partNumber
// @desc    Get BOM item by part number
// @access  Private
router.get('/item/:partNumber', protect, async (req, res) => {
    try {
        const { partNumber } = req.params;
        
        const item = await BOMItem.findOne({ 
            item: { $regex: new RegExp(`^${partNumber}$`, 'i') }
        });

        if (!item) {
            return res.status(404).json({ message: 'Part number not found' });
        }

        res.json(item);
    } catch (error) {
        console.error('Get item error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/bom/all
// @desc    Get all BOM items
// @access  Private
router.get('/all', protect, async (req, res) => {
    try {
        const items = await BOMItem.find().sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        console.error('Get all items error:', error);
        // Return empty array in demo mode
        res.json([]);
    }
});

// @route   POST /api/bom/item
// @desc    Create a new BOM item
// @access  Private
router.post('/item', protect, async (req, res) => {
    try {
        const {
            item,
            itemDescription,
            quantity,
            partType,
            currency,
            unitPrice,
            customAttributes
        } = req.body;

        const bomItem = await BOMItem.create({
            item,
            itemDescription,
            quantity,
            partType,
            currency,
            unitPrice,
            customAttributes
        });

        res.status(201).json(bomItem);
    } catch (error) {
        console.error('Create item error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/bom/item/:id
// @desc    Update a BOM item
// @access  Private
router.put('/item/:id', protect, async (req, res) => {
    try {
        const {
            item,
            itemDescription,
            quantity,
            partType,
            currency,
            unitPrice,
            customAttributes
        } = req.body;

        const bomItem = await BOMItem.findById(req.params.id);

        if (!bomItem) {
            return res.status(404).json({ message: 'Item not found' });
        }

        if (item) bomItem.item = item;
        if (itemDescription) bomItem.itemDescription = itemDescription;
        if (quantity) bomItem.quantity = quantity;
        if (partType) bomItem.partType = partType;
        if (currency) bomItem.currency = currency;
        if (unitPrice !== undefined) bomItem.unitPrice = unitPrice;
        
        if (customAttributes && typeof customAttributes === 'object') {
            for (const [key, value] of Object.entries(customAttributes)) {
                bomItem.customAttributes.set(key, value);
            }
        }

        await bomItem.save();

        res.json(bomItem);
    } catch (error) {
        console.error('Update item error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/bom/item/:id
// @desc    Delete a BOM item
// @access  Private
router.delete('/item/:id', protect, async (req, res) => {
    try {
        const item = await BOMItem.findById(req.params.id);

        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        await item.deleteOne();

        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        console.error('Delete item error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/bom/columns
// @desc    Get all available column headers from all uploaded files
// @access  Private
router.get('/columns', protect, async (req, res) => {
    try {
        const files = await BOMFile.find().select('columnHeaders').sort({ createdAt: -1 }).limit(10);
        
        const allColumns = new Set();
        files.forEach(file => {
            file.columnHeaders.forEach(col => allColumns.add(col));
        });

        res.json(Array.from(allColumns));
    } catch (error) {
        console.error('Get columns error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/bom/custom-attribute/:id
// @desc    Add custom attribute to a BOM item
// @access  Private
router.post('/custom-attribute/:id', protect, async (req, res) => {
    try {
        const { key, value } = req.body;

        if (!key) {
            return res.status(400).json({ message: 'Attribute key is required' });
        }

        const item = await BOMItem.findById(req.params.id);

        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        item.customAttributes.set(key, value);
        await item.save();

        res.json({ 
            message: 'Custom attribute added',
            customAttributes: Object.fromEntries(item.customAttributes)
        });
    } catch (error) {
        console.error('Add custom attribute error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/bom/template
// @desc    Generate and download BOM template
// @access  Private
router.get('/template', protect, async (req, res) => {
    try {
        // Get existing columns to create a template with all available fields
        const files = await BOMFile.find().select('columnHeaders').sort({ createdAt: -1 }).limit(10);
        
        const allColumns = new Set([
            'Item',
            'Item Description',
            'Quantity',
            'Part Type',
            'Currency',
            'Unit Price'
        ]);
        
        files.forEach(file => {
            file.columnHeaders.forEach(col => allColumns.add(col));
        });

        // Create template with empty values
        const templateData = Array.from(allColumns).map(col => ({ [col]: '' }));
        
        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'BOM Template');

        const tempPath = path.join(__dirname, '../uploads/BOM_Template.xlsx');
        XLSX.writeFile(workbook, tempPath);

        res.download(tempPath, 'BOM_Template.xlsx', (err) => {
            if (err) {
                console.error('Download error:', err);
            }
            // Clean up temp file
            try {
                fs.unlinkSync(tempPath);
            } catch (e) {
                console.error('Error deleting temp file:', e);
            }
        });
    } catch (error) {
        console.error('Template error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/bom/my-files
// @desc    Get all uploaded files for current user with file count info
// @access  Private
router.get('/my-files', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const files = await BOMFile.find({ uploadedBy: req.user._id })
            .sort({ createdAt: -1 })
            .select('-bomData -path');

        res.json({
            files: files,
            fileCount: files.length,
            maxFiles: MAX_FILES_PER_USER,
            canUploadMore: files.length < MAX_FILES_PER_USER,
            parentPartNumber: user.parentPartNumber
        });
    } catch (error) {
        console.error('Get my files error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/bom/set-parent-part
// @desc    Set the parent part number for BOM calculation
// @access  Private
router.post('/set-parent-part', protect, async (req, res) => {
    try {
        const { partNumber, fileId } = req.body;

        if (!partNumber) {
            return res.status(400).json({ message: 'Part number is required' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.parentPartNumber = partNumber;
        await user.save();

        if (fileId) {
            await BOMFile.updateMany({ uploadedBy: req.user._id }, { isParent: false });
            await BOMFile.findByIdAndUpdate(fileId, { 
                isParent: true,
                parentPartNumber: partNumber
            });
        }

        res.json({
            message: 'Parent part number set successfully',
            parentPartNumber: partNumber
        });
    } catch (error) {
        console.error('Set parent part error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/bom/calculate-bom-cost
// @desc    Calculate BOM cost using the parent part number
// @access  Private
router.post('/calculate-bom-cost', protect, async (req, res) => {
    try {
        const { partNumber } = req.body;

        if (!partNumber) {
            return res.status(400).json({ message: 'Part number is required' });
        }

        const items = await BOMItem.find({
            item: { $regex: new RegExp(`^${partNumber}$`, 'i') }
        });

        if (!items || items.length === 0) {
            return res.status(404).json({ message: 'Part number not found in any uploaded file' });
        }

        let totalCost = 0;
        const itemDetails = [];

        for (const item of items) {
            const itemCost = (item.unitPrice || 0) * (item.quantity || 1);
            totalCost += itemCost;
            
            itemDetails.push({
                item: item.item,
                itemDescription: item.itemDescription,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: itemCost,
                currency: item.currency,
                partType: item.partType
            });
        }

        const exchangeRates = {
            INR: 1,
            USD: 0.012,
            EUR: 0.011,
            GBP: 0.0095
        };

        const costsInCurrencies = {
            INR: totalCost,
            USD: totalCost * exchangeRates.USD,
            EUR: totalCost * exchangeRates.EUR,
            GBP: totalCost * exchangeRates.GBP
        };

        res.json({
            parentPartNumber: partNumber,
            totalItems: items.length,
            costs: costsInCurrencies,
            itemDetails: itemDetails
        });
    } catch (error) {
        console.error('Calculate BOM cost error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/bom/upload-multiple
// @desc    Upload BOM file with file count check
// @access  Private
router.post('/upload-multiple', protect, upload.single('file'), async (req, res) => {
    try {
        const userFiles = await BOMFile.find({ uploadedBy: req.user._id });
        
        if (userFiles.length >= MAX_FILES_PER_USER) {
            if (req.file && req.file.path) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (err) {
                    console.error('Error deleting file:', err);
                }
            }
            return res.status(400).json({ 
                message: `Maximum file limit (${MAX_FILES_PER_USER}) reached. Please delete existing files to upload new ones.`,
                fileCount: userFiles.length,
                maxFiles: MAX_FILES_PER_USER
            });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const bomData = XLSX.utils.sheet_to_json(worksheet);
        
        if (bomData.length === 0) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'No data found in the file' });
        }

        const columnHeaders = Object.keys(bomData[0]);
        const missingColumns = getMissingColumns(columnHeaders);
        
        if (missingColumns.length === REQUIRED_BOM_COLUMNS.length) {
            fs.unlinkSync(req.file.path);
            return res.status(200).json({
                message: 'No required columns found in the file',
                hasRequiredColumns: false,
                missingColumns: missingColumns,
                availableColumns: columnHeaders
            });
        }
        
        if (missingColumns.length > 0) {
            return res.status(200).json({
                message: 'Some required columns are missing',
                hasRequiredColumns: false,
                missingColumns: missingColumns,
                availableColumns: columnHeaders
            });
        }

        const firstPartNumber = bomData[0].Item || bomData[0]['Part Number'] || null;
        const isFirstFile = userFiles.length === 0;

        const bomFile = await BOMFile.create({
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            path: req.file.path,
            uploadedBy: req.user._id,
            bomData: bomData,
            columnHeaders: columnHeaders,
            rowCount: bomData.length,
            status: 'processed',
            isParent: isFirstFile,
            parentPartNumber: firstPartNumber
        });

        for (const item of bomData) {
            await BOMItem.create({
                item: item.Item || item['Part Number'] || item['Material ID'] || 'Unknown',
                itemDescription: item['Item Description'] || item.Description || '',
                quantity: parseFloat(item.Quantity || item.qty || 1),
                partType: item['Part Type'] || item['PartType'] || '',
                currency: item.Currency || 'INR',
                unitPrice: parseFloat(item['Unit Price'] || item['unitPrice'] || item.Price || 0),
                customAttributes: item
            });
        }

        const user = await User.findById(req.user._id);
        user.uploadedFileCount = userFiles.length + 1;
        if (!user.uploadedFiles) {
            user.uploadedFiles = [];
        }
        user.uploadedFiles.push(bomFile._id);
        
        if (isFirstFile && firstPartNumber) {
            user.parentPartNumber = firstPartNumber;
        }
        await user.save();

        res.status(201).json({
            message: 'File uploaded successfully',
            file: {
                _id: bomFile._id,
                originalName: bomFile.originalName,
                rowCount: bomFile.rowCount,
                columnHeaders: bomFile.columnHeaders,
                createdAt: bomFile.createdAt,
                isParent: bomFile.isParent,
                parentPartNumber: bomFile.parentPartNumber
            },
            fileCount: userFiles.length + 1,
            maxFiles: MAX_FILES_PER_USER,
            canUploadMore: (userFiles.length + 1) < MAX_FILES_PER_USER
        });
    } catch (error) {
        console.error('Upload error:', error);
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (err) {
                console.error('Error deleting file:', err);
            }
        }
        res.status(500).json({ message: 'Server error during file upload' });
    }
});

module.exports = router;
