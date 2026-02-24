<readme.md>



# BOM Cost Calculator - Full Stack Application

A full-stack BOM (Bill of Materials) Cost Calculator application with Express.js backend and MongoDB database.

## Features

- 🔐 User Authentication (Login/Register)
- 📊 BOM Cost Calculator with multiple currency support
- 📁 Excel File Upload & Processing
- 💾 MongoDB Database Storage
- 🔧 Flexible Schema (add custom attributes anytime)
- 🖥️ Support for Local, Test, and Production environments

## Project Structure

```
bom-cost-calculator/
├── server/
│   ├── config/
│   │   └── db.js              # MongoDB connection
│   ├── middleware/
│   │   ├── auth.js            # JWT authentication
│   │   └── upload.js          # File upload handling
│   ├── models/
│   │   ├── User.js            # User model
│   │   └── BOM.js             # BOM data model
│   ├── routes/
│   │   ├── userRoutes.js      # User API routes
│   │   └── bomRoutes.js       # BOM API routes
│   ├── uploads/               # Uploaded files storage
│   ├── index.js               # Server entry point
│   └── .env*                  # Environment configs
├── frontend/
│   └── index.html             # Frontend UI
├── package.json               # Dependencies
└── README.md                  # This file
```

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)

## Installation

1. **Install Node.js dependencies:**
   
```
bash
   npm install
   
```

2. **Configure MongoDB:**
   
   Edit `server/.env` file with your MongoDB connection string:
   
```
   MONGODB_URI=mongodb://localhost:27017/bom_calculator
   
```

3. **Start MongoDB:**
   
```
bash
   # On Windows
   net start MongoDB
   
   # On Linux/Mac
   sudo systemctl start mongod
   
```

4. **Start the server:**
   
```
bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   
```

5. **Open the application:**
   Navigate to `http://localhost:5000` in your browser.

## Environment Configuration

### Development (.env)
```
env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/bom_calculator
JWT_SECRET=your-dev-secret
NODE_ENV=development
```

### Test (.env.test)
```
env
PORT=5000
MONGODB_URI=mongodb://testserver:27017/bom_calculator_test
JWT_SECRET=test-secret
NODE_ENV=test
```

### Production (.env.production)
```
env
PORT=5000
MONGODB_URI=mongodb://prodserver:27017/bom_calculator_production
JWT_SECRET=generate-strong-secret
NODE_ENV=production
```

## Switching Environments

- **Development:** Default (uses .env)
- **Test:** Run with `NODE_ENV=test node server/index.js`
- **Production:** Run with `NODE_ENV=production node server/index.js`

## API Endpoints

### Authentication
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - Login user
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update user profile
- `PUT /api/users/password` - Update password

### BOM Management
- `POST /api/bom/upload` - Upload BOM Excel file
- `GET /api/bom/files` - Get all uploaded files
- `GET /api/bom/files/:id` - Get specific file
- `DELETE /api/bom/files/:id` - Delete file
- `GET /api/bom/item/:partNumber` - Get BOM item by part number
- `GET /api/bom/all` - Get all BOM items
- `POST /api/bom/item` - Create new BOM item
- `PUT /api/bom/item/:id` - Update BOM item
- `DELETE /api/bom/item/:id` - Delete BOM item
- `GET /api/bom/template` - Download BOM template
- `GET /api/bom/columns` - Get available column headers
- `POST /api/bom/custom-attribute/:id` - Add custom attribute

## Default Admin User

After first run, register a new user through the UI. To make a user admin, update their role in MongoDB:

```
javascript
db.users.updateOne({ username: "admin" }, { $set: { role: "admin" } })
```

## Excel File Format

The uploaded Excel file should contain the following columns:
- `Item` - Part Number / Material ID
- `Item Description` - Description of the item
- `Quantity` - Number of items
- `Part Type` - Type of part
- `Currency` - Currency code (INR, USD, EUR, GBP)
- `Unit Price` - Price per unit

Additional custom columns will be automatically detected and stored.

## Flexible Schema

This application supports adding custom attributes:

1. **Users:** Add custom attributes to user profiles
2. **BOM Items:** Add custom attributes to BOM items
3. **Files:** Add custom attributes to uploaded files

Use the API endpoints to add/remove custom attributes at any time.

## Currency Exchange

The application uses fixed exchange rates. To update rates, modify `server/routes/bomRoutes.js`:

```
javascript
const EXCHANGE_RATES = {
    INR: 1,
    USD: 0.012,
    EUR: 0.011,
    GBP: 0.0095
};
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Update MongoDB URI to production server
3. Generate a strong JWT secret
4. Use HTTPS in production
5. Consider using PM2 for process management

## License

MIT © Tata
