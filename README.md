# 🚀 IT Asset Tracker - Modern Web Application

A comprehensive, full-stack IT asset management system built with the **MERN stack** (MongoDB, Express, React, Node.js) featuring real-time updates, advanced security, and beautiful modern UI.

## ✨ Features

### 🔐 Security & Authentication
- **Modern Password Management** with strength meter and real-time feedback
- **Two-Factor Authentication (2FA)** support
- **Session Management** with automatic logout
- **JWT-based Authentication** with secure token storage
- **Rate Limiting** to prevent brute force attacks
- **Password Hashing** using bcryptjs
- **CORS Protection** and Helmet security headers
- **Input Sanitization** to prevent XSS attacks

### 👤 User Management
- **Intuitive Registration** with email validation
- **Profile Customization** (name, phone, department)
- **Role-based Access Control** (User, Admin)
- **Account Activity Timeline** with detailed logs
- **Multi-session Management** with device tracking
- **Notification Preferences** customization

### 📊 Dashboard & Analytics
- **Real-time Asset Statistics** with live updates
- **Asset Status Visualization** (Pie charts)
- **Activity Timeline** with rich filtering
- **Audit Logs** for compliance and tracking
- **Export Capabilities** (CSV, PDF)
- **Advanced Search** and filtering options

### 🎨 Modern UI/UX
- **Animated Components** using Framer Motion
- **Responsive Design** optimized for all devices
- **Gradient Backgrounds** and glassmorphism effects
- **Dark Mode Support** (coming soon)
- **Mobile-first Approach**
- **Accessibility Features** (ARIA labels, keyboard navigation)
- **Custom Design System** with consistent theming

### 🔄 Real-time Features
- **Socket.IO Integration** for live updates
- **Real-time Notifications** for asset changes
- **Live Collaborative** asset management
- **Instant Audit Logging**

### 📱 Browser Support
- Chrome/Chromium (Latest)
- Firefox (Latest)
- Safari (Latest)
- Edge (Latest)

## 🛠️ Tech Stack

### Frontend
```
React 18.3        - UI Library
Vite 5.4          - Build tool
Framer Motion 12  - Animations
Recharts 2.15     - Charts & Graphs
React Router 6    - Routing
Axios 1.7         - HTTP Client
React Toastify   - Notifications
Socket.io Client  - Real-time communication
Tailwind CSS 4    - Styling
```

### Backend
```
Node.js           - Runtime
Express 4.19      - Web Framework
MongoDB 8.5       - Database (via Mongoose)
JWT 9.0           - Authentication
bcryptjs 2.4      - Password hashing
Helmet 8.1        - Security headers
CORS 2.8          - Cross-origin requests
Rate-limit 8.2    - Request limiting
Socket.io 4.8     - Real-time protocol
Qrcode 1.5        - QR code generation
Node-cron 3.0     - Scheduled tasks
```

## 🚀 Getting Started

### Prerequisites
- Node.js v16+ and npm/yarn
- MongoDB Local or Atlas connection
- Modern web browser

### Installation

#### 1. Clone Repository
```bash
git clone <repository-url>
cd chatgpt-project-tracking
```

#### 2. Backend Setup
```bash
cd backend
npm install

# Create .env file
# PORT=5000
# MONGO_URI=mongodb://localhost:27017/asset-tracker
# JWT_SECRET=your_super_secret_key
# FRONTEND_URL=http://localhost:5173

npm run dev
```

#### 3. Frontend Setup
```bash
cd frontend
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 📁 Project Structure

```
chatgpt-project-tracking/
├── backend/
│   ├── config/
│   │   └── db.js                 # MongoDB connection
│   ├── controllers/
│   │   ├── assetController.js   # Asset CRUD operations
│   │   ├── authController.js    # Authentication logic
│   │   └── ...
│   ├── middleware/
│   │   ├── authMiddleware.js    # JWT verification
│   │   ├── roleMiddleware.js    # Role-based access control
│   │   └── ...
│   ├── models/
│   │   ├── User.js              # User schema
│   │   ├── Asset.js             # Asset schema
│   │   ├── AuditLog.js          # Audit log schema
│   │   └── ...
│   ├── routes/
│   │   ├── authRoutes.js        # Auth endpoints
│   │   ├── assetRoutes.js       # Asset endpoints
│   │   ├── auditRoutes.js       # Audit endpoints
│   │   └── ...
│   ├── utils/
│   │   ├── security.js          # Security utilities
│   │   └── ...
│   ├── server.js                # Express server
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── UI.jsx           # Reusable UI components
│   │   │   ├── AdminRoute.jsx   # Admin protection
│   │   │   ├── PrivateRoute.jsx # Auth protection
│   │   │   ├── layout/          # Layout components
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── Login.jsx        # Login page
│   │   │   ├── Register.jsx     # Registration page
│   │   │   ├── Dashboard.jsx    # Dashboard
│   │   │   ├── Assets.jsx       # Assets management
│   │   │   ├── AuditLogs.jsx    # Audit logs
│   │   │   ├── Settings.jsx     # User settings
│   │   │   └── ...
│   │   ├── services/
│   │   │   └── socket.js        # Socket configuration
│   │   ├── context/
│   │   │   └── AuthContext.jsx  # Auth context
│   │   ├── utils/
│   │   │   ├── validation.js    # Form validation
│   │   │   ├── animations.js    # Animation variants
│   │   │   ├── axiosConfig.js   # Axios setup
│   │   │   └── ...
│   │   ├── config/
│   │   │   └── theme.js         # Design system
│   │   ├── App.jsx              # Main app component
│   │   └── main.jsx             # React entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

## 🔑 Key Features Explained

### Modern Authentication
- Email/password authentication with validation
- Password strength meter with real-time feedback
- Secure password hashing with bcryptjs
- JWT tokens with expiration
- Local storage management

### Role-Based Access Control (RBAC)
- **Admin**: Full system access, audit logs, user management
- **User**: Can only manage their own assets

### Real-time Updates
- Asset creation/updates trigger instant notifications
- Socket.IO connections for live dashboard updates
- Activity feeds update in real-time across all connected clients

### Advanced Audit Logging
- Tracks all user actions
- Records IP address and user agent
- Timestamps all changes
- Sortable and filterable logs
- Export capabilities

## 🎯 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/logout-all` - Logout from all sessions

### Assets
- `GET /api/assets` - Get all assets
- `POST /api/assets` - Create asset (Admin)
- `PUT /api/assets/:id` - Update asset (Admin)
- `DELETE /api/assets/:id` - Delete asset (Admin)

### Audit Logs
- `GET /api/audit` - Get audit logs (Admin only)
- `GET /api/audit/:id` - Get specific log (Admin only)

## 🔒 Security Best Practices

✅ **Implemented**
- HTTPS ready
- CORS configured
- Helmet security headers
- Rate limiting
- Input validation & sanitization
- Password hashing (bcryptjs)
- JWT authentication
- Secure session management

🔒 **Recommended for Production**
- Enable HTTPS/TLS
- Use environment variables
- Set up MongoDB Atlas (not local)
- Configure proper CORS origins
- Implement 2FA fully
- Set up regular backups
- Monitor logs regularly
- Use staging environment

## 📊 Performance Optimizations

- Code splitting with Vite
- Lazy loading routes
- Image optimization
- Efficient state management
- Database indexing
- Rate limiting
- Caching strategies
- Socket.IO namespaces

## 🧪 Testing

### Frontend Testing
```bash
cd frontend
npm run test
```

### Backend Testing
```bash
cd backend
npm run test
```

## 📝 Best Practices for IT Students

This project demonstrates:
- **Full-Stack Development** with modern technologies
- **Security Principles** (authentication, authorization, input validation)
- **Real-time Communication** using WebSockets
- **Database Design** with MongoDB
- **RESTful API** architecture
- **Component-Based Architecture** in React
- **Error Handling** and logging
- **User Experience** with animations
- **Responsive Design** principles
- **Code Organization** and modularity

## 🎓 Learning Path

1. **Understand Authentication** - Review `authController.js` and `Login.jsx`
2. **Explore Real-time Features** - Check `socket.js` configuration
3. **Study UI Components** - Look at reusable components in `UI.jsx`
4. **Database Design** - Examine `models/*.js` files
5. **API Integration** - Review axios calls and error handling
6. **State Management** - Study `AuthContext.jsx`

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit changes with clear messages
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - Free to use for educational purposes

## 🆘 Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check connection string in `.env`
- Verify network access for Atlas

### CORS Errors
- Check `FRONTEND_URL` in `.env`
- Ensure backend CORS is configured
- Verify frontend URL matches

### Socket.IO Connection Failed
- Check backend is running on correct port
- Verify Socket.IO is imported correctly
- Check browser console for errors

## 📞 Support

For issues or questions:
- Check existing GitHub issues
- Review error logs
- Consult documentation
- Reach out to the team

## 🌟 Future Enhancements

- [ ] Full Dark Mode implementation
- [ ] Email notifications
- [ ] PDF export for reports
- [ ] Advanced analytics dashboard
- [ ] Mobile app (React Native)
- [ ] AI-powered asset recommendations
- [ ] Blockchain-based audit trail
- [ ] Advanced 2FA options (Authenticator app, SMS)
- [ ] Multi-language support
- [ ] Advanced reporting engine

---

**Built with ❤️ by IT Enthusiasts | Made for Modern Development**

*This project showcases enterprise-grade web development practices suitable for production environments.*
