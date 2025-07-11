# MatchMaker Backend

Backend server for the MatchMaker application, providing APIs for user authentication, personal statement generation, CV parsing, and more.

## Tech Stack

- Node.js with Express
- MongoDB
- JWT Authentication
- OpenAI API integration
- AWS S3 for file storage
- PDF generation

## Prerequisites

Before running the backend, ensure you have the following installed:

- Node.js (v14+)
- MongoDB (local or Atlas)
- AWS account for S3 storage
- OpenAI API key

## Setup Instructions

1. Clone the repository

```bash
git clone <repository-url>
cd matchmaker/backend
```

2. Install dependencies

```bash
npm install
```

3. Set up environment variables

Create a `.env` file in the root directory with the following variables:

```
MONGODB_URI=mongodb://localhost:27017/matchmaker
JWT_SECRET=your_jwt_secret_key
OPENAI_API_KEY=your_openai_api_key
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=matchmaker-uploads
PORT=5000
```

4. Start the server

For development:
```bash
npm run dev
```

For production:
```bash
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login a user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/upload-profile-image` - Upload profile image
- `POST /api/auth/upload-cv` - Upload CV

### Dashboard

- `GET /api/dashboard` - Get application progress
- `GET /api/dashboard/check-readiness` - Check if application is ready for program recommendations

### Personal Statement

- `GET /api/personal-statement` - Get personal statement data
- `POST /api/personal-statement` - Save initial personal statement data
- `POST /api/personal-statement/generate-thesis` - Generate thesis statements
- `PUT /api/personal-statement/select-thesis` - Save selected thesis
- `POST /api/personal-statement/generate-final` - Generate final statement
- `PUT /api/personal-statement/save-final` - Save final statement

### Research Products

- `GET /api/research` - Get all research products
- `POST /api/research/parse-cv` - Parse CV for research products
- `POST /api/research` - Add a research product
- `PUT /api/research/:id` - Update a research product
- `DELETE /api/research/:id` - Delete a research product

### Experiences

- `GET /api/experiences` - Get all experiences
- `POST /api/experiences/parse-cv` - Parse CV for experiences
- `POST /api/experiences` - Add an experience
- `PUT /api/experiences/:id` - Update an experience
- `DELETE /api/experiences/:id` - Delete an experience
- `PUT /api/experiences/meaningful/set` - Set most meaningful experiences
- `POST /api/experiences/:id/expand` - Generate expanded description

### Miscellaneous Questions

- `GET /api/misc` - Get miscellaneous data
- `POST /api/misc` - Save all miscellaneous data
- `PUT /api/misc/professionalism` - Save professionalism data
- `PUT /api/misc/education` - Save education data
- `POST /api/misc/honors` - Add honor/award
- `PUT /api/misc/honors/:id` - Update honor/award
- `DELETE /api/misc/honors/:id` - Delete honor/award
- `PUT /api/misc/impactful-hobbies` - Save impactful experience and hobbies

### Program Preferences

- `GET /api/programs/preferences` - Get program preferences
- `POST /api/programs/preferences` - Save program preferences
- `GET /api/programs/recommendations` - Get program recommendations

### Application

- `GET /api/application/generate` - Generate application PDF

## License

MIT 