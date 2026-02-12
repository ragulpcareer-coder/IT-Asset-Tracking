## 🔥 QUICK REFERENCE & USAGE GUIDE

### How to Use New Components

#### 1. Button Component
```jsx
import { Button } from "../components/UI";

// Primary button
<Button variant="primary" size="md">Sign In</Button>

// Danger button with loading
<Button variant="danger" loading={isLoading} disabled={isLoading}>
  Delete Account
</Button>

// With icon
<Button icon="🚀">Launch</Button>
```

#### 2. Input Component
```jsx
import { Input } from "../components/UI";

<Input
  label="Email"
  type="email"
  icon="📧"
  placeholder="user@example.com"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={errors.email}
  required
  hint="Use valid email format"
/>
```

#### 3. Password Strength Meter
```jsx
import { PasswordStrengthMeter } from "../components/UI";
import { getPasswordRequirements } from "../utils/validation";

const requirements = getPasswordRequirements();

<PasswordStrengthMeter 
  password={password}
  requirements={requirements}
/>
```

#### 4. Card Component
```jsx
import { Card } from "../components/UI";

<Card variant="gradient" className="mb-4">
  <h3>Card Title</h3>
  <p>Card content goes here...</p>
</Card>
```

#### 5. Badge Component
```jsx
import { Badge } from "../components/UI";

<Badge variant="success" size="md">✓ Verified</Badge>
<Badge variant="error" size="sm">Error</Badge>
```

#### 6. Alert Component
```jsx
import { Alert } from "../components/UI";

<Alert
  type="error"
  title="Error occurred"
  message="Something went wrong"
  onClose={() => setError(false)}
/>
```

---

### How to Use Validation

#### Email Validation
```jsx
import { validateEmail } from "../utils/validation";

const isValid = validateEmail("user@example.com");
```

#### Password Strength
```jsx
import { checkPasswordStrength, getPasswordRequirements } from "../utils/validation";

const strength = checkPasswordStrength(password);
console.log(strength.score); // 0-6
console.log(strength.level); // "Very Weak" to "Very Strong"
console.log(strength.feedback); // Array of improvements

// Get requirements list
const requirements = getPasswordRequirements();
// [
//   { id: "length", label: "At least 8 characters", check: (pwd) => ... },
//   { id: "uppercase", label: "One uppercase letter", check: (pwd) => ... },
//   ...
// ]
```

#### Generate Strong Password
```jsx
import { generateStrongPassword } from "../utils/validation";

const newPassword = generateStrongPassword(12); // 12 chars
```

---

### How to Use Animations

#### Animate Component Entrance
```jsx
import { motion } from "framer-motion";
import { animationVariants } from "../utils/animations";

<motion.div
  initial="hidden"
  animate="visible"
  variants={animationVariants.containerVariants}
>
  {/* Content */}
</motion.div>
```

#### Stagger Children
```jsx
<motion.div
  initial="hidden"
  animate="visible"
  variants={animationVariants.containerVariants}
>
  {items.map((item, idx) => (
    <motion.div
      key={idx}
      variants={animationVariants.itemVariants}
    >
      {item}
    </motion.div>
  ))}
</motion.div>
```

#### Button Animation
```jsx
<motion.button
  whileHover={animationVariants.buttonHover}
  whileTap={animationVariants.buttonTap}
>
  Click me
</motion.button>
```

---

### How to Use Theme

```jsx
import { theme } from "../config/theme";

// Access colors
const primaryColor = theme.colors.primary[500]; // #3b82f6

// Use in styles
const styles = {
  background: theme.colors.gradients.blueToViolet,
  padding: theme.spacing.md,
  borderRadius: theme.radius.lg,
};

// Typography
const heading = theme.typography.heading2;
// { fontSize: "2rem", fontWeight: "700", ... }
```

---

### Backend Security Usage

```javascript
const { 
  RateLimiter, 
  validatePasswordStrength,
  isValidEmail,
  sanitizeInput
} = require("../utils/security");

// Rate limiting
const limiter = new RateLimiter(5, 15 * 60 * 1000);
if (limiter.isLimited(userEmail)) {
  return res.status(429).json({ message: "Too many attempts" });
}

// Validate password
const strength = validatePasswordStrength(password);
if (!strength.isStrong) {
  return res.status(400).json({ feedback: strength.feedback });
}

// Validate email
if (!isValidEmail(email)) {
  return res.status(400).json({ message: "Invalid email" });
}

// Sanitize input
const safeName = sanitizeInput(userInput);
```

---

### Starting the Application

#### Frontend
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

#### Backend
```bash
cd backend
npm install

# Create .env file with:
# PORT=5000
# MONGO_URI=mongodb://localhost:27017/asset-tracker
# JWT_SECRET=your_secret_key

npm run dev
# Runs on http://localhost:5000
```

---

### File Structure Reference

```
Frontend Key Files:
src/
├── components/UI.jsx              ← All reusable components
├── config/theme.js                ← Design system
├── utils/
│   ├── validation.js              ← Form validators
│   ├── animations.js              ← Animation variants
│   └── axiosConfig.js             ← API client setup
├── pages/
│   ├── Login.jsx                  ← Modern login page
│   ├── Register.jsx               ← Modern registration
│   └── Settings.jsx               ← 5-tab settings page
└── context/AuthContext.jsx        ← Auth state

Backend Key Files:
├── controllers/authController.js  ← Enhanced auth with security
├── utils/security.js              ← Security helpers
├── middleware/
│   ├── authMiddleware.js          ← JWT verification
│   └── roleMiddleware.js          ← Role checking
├── models/User.js                 ← User schema
└── routes/authRoutes.js           ← Auth endpoints
```

---

### Common Tasks

#### Change Button Color
```jsx
// In theme.js
primary: "bg-gradient-to-r from-blue-600 to-blue-700 text-white"

// Change to:
primary: "bg-gradient-to-r from-purple-600 to-purple-700 text-white"
```

#### Add New Form Input
```jsx
<Input
  label="New Field"
  icon="🎯"
  value={value}
  onChange={(e) => setValue(e.target.value)}
  error={errors.newField}
/>
```

#### Add New Animation
```javascript
// In animations.js
newAnimation: {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.5 },
}
```

#### Add Backend Rate Limiting
```javascript
import { RateLimiter } from "../utils/security";

const loginLimiter = new RateLimiter(5, 15 * 60 * 1000);

app.post("/login", (req, res) => {
  if (loginLimiter.isLimited(req.body.email)) {
    return res.status(429).json({ message: "Too many attempts" });
  }
  // ... continue with login
});
```

---

### Testing Credentials (Development)

For testing dark mode toggle:
```javascript
// In PreferencesTab
const [preferences, setPreferences] = useState({
  theme: "light", // Change to "dark" to test
  // ...
})
```

For testing 2FA:
```javascript
// In SecurityTab
const [preferences, setPreferences] = useState({
  twoFactorEnabled: false, // Change to true to test
  // ...
})
```

---

### Environment Variables Template

#### Frontend (.env if needed)
```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

#### Backend (.env)
```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/asset-tracker
JWT_SECRET=your_very_secure_secret_key_here
FRONTEND_URL=http://localhost:5173
JWT_EXPIRE=7d
BCRYPT_ROUNDS=12
```

---

### Troubleshooting

#### Components not rendering
- Check if UI.jsx is imported correctly
- Verify Framer Motion is installed
- Check browser console for errors

#### Animations not working
- Ensure Framer Motion version is ^12.0
- Check animation variants are exported
- Verify motion components are used (not regular divs)

#### Validation not working
- Check validation.js is imported
- Verify form state is being updated
- Check error state is being displayed

#### Backend not connecting
- Verify MongoDB is running
- Check .env variables
- Test connection with `npm test`

#### Styling issues
- Verify Tailwind is configured
- Check class names are correct
- Clear cache: `npm run build`

---

### Performance Tips

1. **Lazy Load Routes**
   ```jsx
   const Settings = lazy(() => import("./pages/Settings"));
   ```

2. **Memoize Components**
   ```jsx
   export const MyComponent = memo(function MyComponent(props) {
     // ...
   });
   ```

3. **Debounce Validation**
   ```jsx
   const debouncedValidate = debounceValidation(handleValidate, 300);
   ```

4. **Use Production Build**
   ```bash
   npm run build  # Frontend
   NODE_ENV=production npm start  # Backend
   ```

---

### Security Checklist

- ✅ Never commit .env files
- ✅ Use strong JWT_SECRET
- ✅ Enable HTTPS in production
- ✅ Set secure CORS origins
- ✅ Use rate limiting on all auth endpoints
- ✅ Hash all passwords
- ✅ Validate all inputs
- ✅ Use secure session storage
- ✅ Implement CSRF protection
- ✅ Keep dependencies updated

---

### Deployment Checklist

- ✅ Build frontend: `npm run build`
- ✅ Set environment variables
- ✅ Database backup created
- ✅ SSL certificate installed
- ✅ Firewall configured
- ✅ Error logging setup
- ✅ Monitor performance
- ✅ Backup strategy in place
- ✅ Disaster recovery plan
- ✅ Security audit completed

---

### Resources

- **Framer Motion Docs:** https://www.framer.com/motion/
- **Tailwind CSS:** https://tailwindcss.com/
- **React:** https://react.dev/
- **Express:** https://expressjs.com/
- **MongoDB:** https://www.mongodb.com/
- **JWT:** https://jwt.io/

---

**Happy Coding! 🚀**

For more information, refer to:
- README.md - Project setup
- IMPROVEMENTS.md - Feature summary
- MODERNIZATION_GUIDE.md - Roadmap
- COMPLETION_SUMMARY.md - What was done
