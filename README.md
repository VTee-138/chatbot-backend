# AI Chatbot SaaS Backend 1

Dự án Backend SaaS được xây dựng với ExpressJS, PostgreSQL và Prisma để phục vụ hệ thống AI Chatbot đa tổ chức.

## 🚀 Tính năng chính

- **Xác thực & Phân quyền**: JWT authentication với refresh token
- **Quản lý tổ chức**: Multi-tenancy với role-based access control
- **API Keys**: Quản lý API keys cho external integrations
- **Bảo mật**: Rate limiting, CORS, Helmet security headers
- **Database**: PostgreSQL với Prisma ORM
- **Scalable Architecture**: Modular structure với middleware patterns

## 📋 Yêu cầu hệ thống

- **Node.js**: >= 18.0.0
- **PostgreSQL**: >= 14.0
- **npm**: >= 8.0.0

## 🛠️ Cài đặt

### 1. Clone repository và cài đặt dependencies

```bash
git clone <your-repo-url>
cd ai-chatbot
npm install
```

### 2. Cấu hình môi trường

Sao chép file `.env.example` thành `.env` và cập nhật các giá trị:

```bash
cp .env.example .env
```

Cập nhật các biến môi trường cần thiết trong `.env`:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/ai_chatbot_db"

# JWT Secrets (QUAN TRỌNG: Thay đổi trong production!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production

# Server
NODE_ENV=development
PORT=3000
```

### 3. Khởi tạo database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed database với dữ liệu mẫu (tùy chọn)
npm run db:seed
```

### 4. Khởi chạy server

```bash
# Development mode với hot reload
npm run dev

# Production mode
npm start
```

Server sẽ chạy tại: `http://localhost:3000`

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication

Tất cả API endpoints (trừ register/login) yêu cầu JWT token trong header:

```
Authorization: Bearer <your-jwt-token>
```

### Endpoints chính

#### 🔐 Authentication (`/auth`)

- `POST /auth/register` - Đăng ký user mới
- `POST /auth/login` - Đăng nhập
- `POST /auth/refresh-token` - Refresh access token
- `POST /auth/logout` - Đăng xuất
- `GET /auth/profile` - Lấy thông tin profile
- `PUT /auth/profile` - Cập nhật profile
- `POST /auth/change-password` - Đổi mật khẩu
- `POST /auth/forgot` - Quên mật khẩu
- `POST /auth/resend/:type` - Dùng dể resend email (:type ở đây hiện tại là 'forgot' và 'register')
- `POST /auth/verify/:type` - Dùng dể verify email (:type ở đây hiện tại là 'forgot' và 'register')
#### 🏢 Organizations (`/organizations`)

- `POST /organizations` - Tạo tổ chức mới
- `GET /organizations` - Lấy danh sách tổ chức của user
- `GET /organizations/:id` - Chi tiết tổ chức
- `PUT /organizations/:id` - Cập nhật tổ chức
- `DELETE /organizations/:id` - Xóa tổ chức
- `GET /organizations/:id/members` - Danh sách thành viên
- `POST /organizations/:id/members` - Mời thành viên
- `PUT /organizations/:id/members/:userId` - Cập nhật role thành viên
- `DELETE /organizations/:id/members/:userId` - Xóa thành viên

#### 🔑 API Keys (`/api-keys`)

- `POST /api-keys` - Tạo API key mới
- `GET /api-keys` - Danh sách API keys
- `GET /api-keys/:id` - Chi tiết API key
- `PUT /api-keys/:id` - Cập nhật API key
- `POST /api-keys/:id/regenerate` - Tạo lại API key
- `DELETE /api-keys/:id` - Xóa API key
- `GET /api-keys/:id/usage` - Thống kê sử dụng

### 🏥 Health Check

```bash
GET /api/v1/health
```

Response:
```json
{
  "success": true,
  "message": "Service is healthy",
  "data": {
    "status": "OK",
    "timestamp": "2025-08-20T10:30:00.000Z",
    "uptime": 3600,
    "version": "1.0.0",
    "environment": "development",
    "database": "Connected"
  }
}
```

## 🗂️ Cấu trúc dự án

```
ai-chatbot/
├── src/
│   ├── config/          # Cấu hình database, app config
│   ├── controllers/     # Business logic handlers
│   ├── middleware/      # Authentication, validation, error handling
│   ├── routes/          # API route definitions
│   ├── services/        # Business service layer
│   ├── utils/           # Helper utilities (crypto, jwt, response)
│   └── server.js        # Main application entry point
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.js          # Database seeding script
├── generated/           # Generated Prisma client
├── .env                 # Environment variables
├── .gitignore
├── package.json
└── README.md
```

## 🛡️ Bảo mật

### Các biện pháp bảo mật được triển khai:

1. **Password Hashing**: Sử dụng bcrypt với 12 rounds
2. **JWT Authentication**: Access token (24h) + Refresh token (7d)
3. **Rate Limiting**: 100 requests/15 minutes per IP
4. **CORS Protection**: Configurable CORS origins
5. **Security Headers**: Helmet.js cho security headers
6. **API Key Hashing**: SHA-256 hashing cho API keys
7. **Input Validation**: Comprehensive request validation
8. **Session Management**: Database-stored sessions với revocation

### Lưu ý bảo mật quan trọng:

⚠️ **QUAN TRỌNG**: Trong production:
- Thay đổi tất cả JWT secrets trong `.env`
- Sử dụng HTTPS
- Cấu hình CORS_ORIGIN với domain cụ thể
- Sử dụng PostgreSQL connection string thật
- Enable database SSL

## 📊 Database Schema

### Users
- Lưu trữ thông tin user, authentication
- Role-based permissions (ADMIN, USER)

### Organizations
- Multi-tenant architecture
- Subscription plans (FREE, BASIC, PRO, ENTERPRISE)

### Organization Members
- Many-to-many relationship User ↔ Organization
- Role-based access (OWNER, ADMIN, MEMBER, VIEWER)

### API Keys
- External integration authentication
- Rate limiting per key
- Organization-level or user-level keys

### Sessions
- JWT token management
- Device/IP tracking
- Session revocation

## 🚀 Deployment

### Environment Variables cần thiết cho Production:

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:port/dbname
JWT_SECRET=your-production-secret-make-it-long
JWT_REFRESH_SECRET=your-production-refresh-secret
CORS_ORIGIN=https://yourdomain.com
```

### Docker Support (tùy chọn)

Tạo `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "start"]
```

## 🧪 Testing

### Test accounts (sau khi chạy seed):

```
Admin: admin@example.com / admin123456
User1: user1@example.com / user123456  
User2: user2@example.com / user123456
```

### Sample API requests:

1. **Register**:
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

2. **Login**:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## 📝 Scripts có sẵn

```bash
npm start          # Khởi chạy production server
npm run dev        # Khởi chạy development server với hot reload
npm run db:generate # Generate Prisma client
npm run db:push    # Push schema changes to database
npm run db:migrate # Run database migrations
npm run db:studio  # Open Prisma Studio
npm run db:reset   # Reset database
npm run db:seed    # Seed database với dữ liệu mẫu
```

## 🤝 Contributing

1. Fork project
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

## 📄 License

Distributed under the ISC License.

## 📞 Support

Nếu bạn gặp vấn đề gì, hãy tạo issue trong GitHub repository hoặc liên hệ team development.

---

**Happy Coding! 🎉**
