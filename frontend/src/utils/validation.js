// Password Strength Checker
export const checkPasswordStrength = (password) => {
  const result = {
    score: 0,
    level: "Very Weak",
    color: "#ef4444",
    feedback: [],
    metrics: {
      length: password.length >= 12,   // Enterprise policy: 12-char minimum
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /[0-9]/.test(password),
      specialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    },
  };

  // Calculate score
  if (password.length >= 8) result.score++;
  if (password.length >= 12) result.score++;
  if (result.metrics.uppercase) result.score++;
  if (result.metrics.lowercase) result.score++;
  if (result.metrics.numbers) result.score++;
  if (result.metrics.specialChars) result.score++;

  // Determine level (max score is now 6)
  if (result.score <= 1) {
    result.level = "Very Weak";
    result.color = "#ef4444";
  } else if (result.score <= 2) {
    result.level = "Weak";
    result.color = "#f97316";
  } else if (result.score <= 3) {
    result.level = "Fair";
    result.color = "#eab308";
  } else if (result.score <= 4) {
    result.level = "Good";
    result.color = "#84cc16";
  } else if (result.score <= 5) {
    result.level = "Strong";
    result.color = "#22c55e";
  } else {
    result.level = "Very Strong";
    result.color = "#16a34a";
  }

  // Generate feedback
  if (!result.metrics.length)
    result.feedback.push("Minimum 12 characters required");
  if (!result.metrics.uppercase)
    result.feedback.push("Add at least one uppercase letter");
  if (!result.metrics.lowercase)
    result.feedback.push("Add at least one lowercase letter");
  if (!result.metrics.numbers)
    result.feedback.push("Add at least one number");
  if (!result.metrics.specialChars)
    result.feedback.push("Add at least one special character (!@#$%^&*)");

  return result;
};

// Email Validator
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate Form Fields
export const validateFormField = (field, value) => {
  const rules = {
    email: (val) => ({
      valid: validateEmail(val),
      error: "Please enter a valid email address",
    }),
    password: (val) => ({
      valid: val.length >= 12 &&
        /[A-Z]/.test(val) &&
        /[a-z]/.test(val) &&
        /[0-9]/.test(val) &&
        /[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]/.test(val),
      error: "Password must be 12+ chars with uppercase, lowercase, number & symbol",
    }),
    confirmPassword: (val, compareWith) => ({
      valid: val === compareWith,
      error: "Passwords do not match",
    }),
    name: (val) => ({
      valid: val.trim().length >= 2,
      error: "Name must be at least 2 characters",
    }),
    url: (val) => {
      try {
        new URL(val);
        return { valid: true, error: "" };
      } catch {
        return { valid: false, error: "Please enter a valid URL" };
      }
    },
  };

  if (rules[field]) {
    return rules[field](value);
  }

  return { valid: true, error: "" };
};

// Debounce validation
export const debounceValidation = (fn, delay = 300) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

// Generate password suggestion
export const generateStrongPassword = (length = 12) => {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  const all = uppercase + lowercase + numbers + special;

  let password = "";
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};

// Format password requirements (Enterprise Policy: 12 char minimum)
export const getPasswordRequirements = () => [
  { id: "length", label: "Minimum 12 characters", check: (pwd) => pwd.length >= 12 },
  { id: "uppercase", label: "At least one uppercase letter (A-Z)", check: (pwd) => /[A-Z]/.test(pwd) },
  { id: "lowercase", label: "At least one lowercase letter (a-z)", check: (pwd) => /[a-z]/.test(pwd) },
  { id: "number", label: "At least one number (0-9)", check: (pwd) => /[0-9]/.test(pwd) },
  {
    id: "special",
    label: "One special character (!@#$%^&*)",
    check: (pwd) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
  },
];
