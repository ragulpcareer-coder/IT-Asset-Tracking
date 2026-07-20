import { validateEmail } from "./validation";

export const ERROR_MESSAGES = {
  required: (label) => `${label} is required.`,
  email: "Email must include @ and a valid domain, for example name@company.com.",
  password:
    "Password needs at least 8 characters, one uppercase letter, one lowercase letter, one number, and one symbol.",
  confirmPassword: "Confirm password must match the password above.",
  verificationCode: "Verification code must be exactly 6 digits.",
  phone: "Phone number can include digits, spaces, +, -, ( ) and must be 7 to 20 characters.",
  assetPrice: "Acquisition cost cannot be negative.",
  usefulLife: "Useful life must be between 1 and 15 years.",
  assignedEmail: "Assigned user email must be valid, for example user@company.com.",
};

export const validateRequired = (value, label) => {
  if (typeof value === "string" && !value.trim()) return ERROR_MESSAGES.required(label);
  if (value === null || value === undefined || value === "") return ERROR_MESSAGES.required(label);
  return "";
};

export const validateEmailField = (value, label = "Email") => {
  const requiredMessage = validateRequired(value, label);
  if (requiredMessage) return requiredMessage;
  return validateEmail(String(value).trim()) ? "" : ERROR_MESSAGES.email;
};

export const validatePasswordField = (value, label = "Password") => {
  const requiredMessage = validateRequired(value, label);
  if (requiredMessage) return requiredMessage;
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(String(value))
    ? ""
    : ERROR_MESSAGES.password;
};

export const validateConfirmPasswordField = (value, password) => {
  const requiredMessage = validateRequired(value, "Confirm password");
  if (requiredMessage) return requiredMessage;
  return String(value) === String(password) ? "" : ERROR_MESSAGES.confirmPassword;
};

export const validatePhoneField = (value) => {
  if (!String(value || "").trim()) return "";
  return /^\+?[0-9\s\-().]{7,20}$/.test(String(value).trim()) ? "" : ERROR_MESSAGES.phone;
};

export const validateVerificationCode = (value) =>
  /^\d{6}$/.test(String(value || "")) ? "" : ERROR_MESSAGES.verificationCode;

export const validateAssetForm = (formData) => {
  const errors = {};

  errors.name = validateRequired(formData.name, "Asset name");
  errors.type = validateRequired(formData.type, "Asset category");
  errors.serialNumber = validateRequired(formData.serialNumber, "Serial number");

  if (formData.status === "assigned") {
    errors.assignedTo = validateEmailField(formData.assignedTo, "Assigned user email");
  } else {
    errors.assignedTo = "";
  }

  const price = Number(formData.purchasePrice);
  if (String(formData.purchasePrice).trim() !== "" && Number.isFinite(price) && price < 0) {
    errors.purchasePrice = ERROR_MESSAGES.assetPrice;
  } else {
    errors.purchasePrice = "";
  }

  const life = Number(formData.usefulLifeYears);
  if (String(formData.usefulLifeYears).trim() !== "" && (!Number.isFinite(life) || life < 1 || life > 15)) {
    errors.usefulLifeYears = ERROR_MESSAGES.usefulLife;
  } else {
    errors.usefulLifeYears = "";
  }

  return errors;
};

export const hasValidationErrors = (errors) => Object.values(errors).some(Boolean);
