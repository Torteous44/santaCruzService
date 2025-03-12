# Santa Cruz Archive Backend

A Node.js backend service for storing and managing historical photos of Santa Cruz. This service provides APIs for uploading, retrieving, and managing photos using MongoDB for storage and Cloudflare Images for CDN.

## Features

- Upload historical photos with metadata (contributor, date, location)
- Store photos on Cloudflare Images CDN
- Manage photo approval workflow (pending, approved, rejected)
- Filter photos by floor, room, and approval status
- Health check and debug endpoints

## Prerequisites

- Node.js 14.x or higher
- MongoDB database (local or Atlas)
- Cloudflare Images account with API key

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000

# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/santa-cruz-archive?retryWrites=true&w=majority

# Cloudflare Images API Configuration
CLOUDFLARE_IMAGES_API_KEY=your_api_key_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_ACCOUNT_HASH=your_account_hash_here
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up your environment variables in `.env`
4. Start the server:
   ```
   npm start
   ```
   
For development with auto-reload:
```
npm run dev
```

## API Endpoints

### Photos

- `GET /api/photos` - Get all photos (with optional status and floorId filters)
- `POST /api/photos/upload` - Upload a new photo
- `PUT /api/photos/:id/approve` - Approve a pending photo
- `PUT /api/photos/:id/reject` - Reject a photo

### Admin

- `GET /api/admin/healthcheck` - Check API health
- `GET /api/admin/debug` - Get debug information

## Upload Photo Example

```bash
curl -X POST http://localhost:5000/api/photos/upload \
  -F "imageFile=@/path/to/photo.jpg" \
  -F "contributor=John Doe" \
  -F "floorId=floor1" \
  -F "roomId=room101"
```

## Directory Structure

```
server/
│
├── .env                  # Environment variables
├── server.js             # Main Express application
│
├── models/
│   └── Photo.js          # MongoDB schema for photos
│
├── routes/
│   ├── photos.js         # API endpoints for photos
│   └── admin.js          # API endpoints for admin functions
│
├── utils/
│   ├── cloudflare.js     # Cloudflare integration utilities
│   └── database.js       # Database connection utilities
│
└── uploads/
    └── temp/             # Temporary storage for uploads
```

## Photo Schema

```javascript
{
  contributor: String,  // Required
  date: String,         // "Mon YYYY" format
  floorId: String,      // Required
  roomId: String,       // Optional
  tempFilePath: String, // Temporary file storage path
  cloudflareId: String, // Cloudflare image ID
  imageUrl: String,     // Cloudflare delivery URL
  originalFileName: String,
  status: String,       // 'pending', 'approved', or 'rejected'
  submittedAt: Date,    // Submission timestamp
  approvedAt: Date      // Approval timestamp
}
```

## License

[MIT](LICENSE) 