// Password Strength Checker
export const checkPasswordStrength = (password) => {
  const result = {
    score: 0,
    level: "Very Weak",
    color: "#ef4444",
    feedback: [],
    metrics: {
      length: password.length >= 8,
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

  // Determine level
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
    result.feedback.push("Use at least 8 characters");
  if (!result.metrics.uppercase)
    result.feedback.push("Add uppercase letters");
  if (!result.metrics.lowercase)
    result.feedback.push("Add lowercase letters");
  if (!result.metrics.numbers)
    result.feedback.push("Add numbers");
  if (!result.metrics.specialChars)
    result.feedback.push("Add special characters");

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
      valid: val.length >= 8,
      error: "Password must be at least 8 characters",
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

// Format password requirements
export const getPasswordRequirements = () => [
  { id: "length", label: "At least 8 characters", check: (pwd) => pwd.length >= 8 },
  { id: "uppercase", label: "One uppercase letter", check: (pwd) => /[A-Z]/.test(pwd) },
  { id: "lowercase", label: "One lowercase letter", check: (pwd) => /[a-z]/.test(pwd) },
  { id: "number", label: "At least one number", check: (pwd) => /[0-9]/.test(pwd) },
  {
    id: "special",
    label: "One special character (!@#$%^&*)",
    check: (pwd) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
  },
];
