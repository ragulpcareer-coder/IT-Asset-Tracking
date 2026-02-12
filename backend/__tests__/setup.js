/**
 * Jest Test Suite Setup
 * 
 * Complete testing framework with:
 * - Unit tests for utilities and helpers
 * - Integration tests for API endpoints
 * - Mock data generators
 * - Test utilities and fixtures
 */

// jest.config.js configuration (place in root)
const jestConfig = {
  testEnvironment: "node",
  collectCoverageFrom: [
    "backend/**/*.js",
    "!backend/**/node_modules/**",
    "!backend/logs/**",
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ["<rootDir>/backend/__tests__/setup.js"],
  testMatch: ["**/__tests__/**/*.test.js"],
  verbose: true,
  forceExit: true,
  testTimeout: 10000,
};

// Sample test for TokenManager
const tokenManagerTest = `
const TokenManager = require('../../utils/tokenManager');

describe('TokenManager', () => {
  let tokenManager;

  beforeEach(() => {
    tokenManager = new TokenManager('test-secret', 'test-refresh-secret');
  });

  describe('generateAccessToken', () => {
    it('should generate valid access token', () => {
      const token = tokenManager.generateAccessToken('user123', 'User');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should generate token with correct payload', () => {
      const token = tokenManager.generateAccessToken('user123', 'Admin');
      const decoded = tokenManager.decodeToken(token);
      
      expect(decoded.userId).toBe('user123');
      expect(decoded.role).toBe('Admin');
      expect(decoded.type).toBe('access');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token with family ID', () => {
      const refreshData = tokenManager.generateRefreshToken('user123', 'User');
      
      expect(refreshData.token).toBeDefined();
      expect(refreshData.tokenId).toBeDefined();
      expect(refreshData.family).toBeDefined();
    });

    it('should preserve family ID on rotation', () => {
      const initial = tokenManager.generateRefreshToken('user123', 'User');
      const rotated = tokenManager.rotateRefreshToken('user123', 'User', initial.family);
      
      expect(rotated.refreshTokenFamily).toBe(initial.family);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const token = tokenManager.generateAccessToken('user123', 'User');
      const result = tokenManager.verifyAccessToken(token);
      
      expect(result.valid).toBe(true);
      expect(result.decoded.userId).toBe('user123');
    });

    it('should reject invalid token', () => {
      const result = tokenManager.verifyAccessToken('invalid-token');
      expect(result.valid).toBe(false);
    });

    it('should reject refresh token as access token', () => {
      const refreshToken = tokenManager.generateRefreshToken('user123', 'User').token;
      const result = tokenManager.verifyAccessToken(refreshToken);
      
      expect(result.valid).toBe(false);
    });
  });

  describe('isTokenExpired', () => {
    it('should detect expired token', (done) => {
      const expiredToken = require('jsonwebtoken').sign(
        { userId: 'user123', type: 'access' },
        'test-secret',
        { expiresIn: '1ms' }
      );

      // Wait for token to expire
      setTimeout(() => {
        expect(tokenManager.isTokenExpired(expiredToken)).toBe(true);
        done();
      }, 10);
    });

    it('should detect valid token as not expired', () => {
      const token = tokenManager.generateAccessToken('user123', 'User');
      expect(tokenManager.isTokenExpired(token)).toBe(false);
    });
  });

  describe('getTokenTimeToLive', () => {
    it('should calculate remaining time', () => {
      const token = tokenManager.generateAccessToken('user123', 'User');
      const ttl = tokenManager.getTokenTimeToLive(token);
      
      // Should be close to 15 minutes (900 seconds)
      expect(ttl).toBeGreaterThan(800000); // 800 seconds
      expect(ttl).toBeLessThan(1000000); // 1000 seconds
    });
  });
});
`;

// Sample RBAC test
const rbacTest = `
const { ROLE_PERMISSIONS, hasPermission, authorizeRoles } = require('../../middleware/rbacMiddleware');

describe('RBAC Middleware', () => {
  describe('hasPermission', () => {
    it('Admin should have all permissions', () => {
      expect(hasPermission('Admin', 'users', 'delete')).toBe(true);
      expect(hasPermission('Admin', 'assets', 'create')).toBe(true);
      expect(hasPermission('Admin', 'auditLogs', 'export')).toBe(true);
    });

    it('Manager should have limited permissions', () => {
      expect(hasPermission('Manager', 'users', 'create')).toBe(false);
      expect(hasPermission('Manager', 'assets', 'read')).toBe(true);
      expect(hasPermission('Manager', 'auditLogs', 'read')).toBe(true);
    });

    it('User should have minimal permissions', () => {
      expect(hasPermission('User', 'users', 'read')).toBe(true);
      expect(hasPermission('User', 'users', 'delete')).toBe(false);
      expect(hasPermission('User', 'auditLogs', 'export')).toBe(false);
    });

    it('Invalid role should return false', () => {
      expect(hasPermission('InvalidRole', 'users', 'read')).toBe(false);
    });
  });

  describe('Permission Matrix', () => {
    it('should have all required resources', () => {
      const resources = ['users', 'assets', 'auditLogs', 'reports', 'settings'];
      
      resources.forEach(resource => {
        expect(ROLE_PERMISSIONS.Admin[resource]).toBeDefined();
      });
    });

    it('should define consistent actions across roles', () => {
      const actions = new Set();
      
      Object.values(ROLE_PERMISSIONS).forEach(permissions => {
        Object.values(permissions).forEach(actionList => {
          actionList.forEach(action => actions.add(action));
        });
      });
      
      expect(actions.size).toBeGreaterThan(0);
    });
  });
});
`;

// Test utilities
const testUtilities = `
/**
 * Test helper functions and fixtures
 */

// Mock data generators
const generateMockUser = (overrides = {}) => ({
  _id: 'test-user-' + Math.random().toString(36).substr(2, 9),
  name: 'Test User',
  email: 'test@example.com',
  role: 'User',
  createdAt: new Date(),
  ...overrides,
});

const generateMockAsset = (overrides = {}) => ({
  _id: 'test-asset-' + Math.random().toString(36).substr(2, 9),
  name: 'Test Asset',
  serialNumber: 'SN-' + Math.random().toString().slice(2, 8),
  category: 'Laptop',
  status: 'active',
  assignedTo: generateMockUser()._id,
  purchaseCost: 1000,
  warrantyExpiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  ...overrides,
});

// Mock database
const mockDatabase = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
};

// Mock JWT
const mockJWT = {
  sign: jest.fn((payload) => 'mock-token'),
  verify: jest.fn((token) => ({ userId: 'test-user' })),
};

module.exports = {
  generateMockUser,
  generateMockAsset,
  mockDatabase,
  mockJWT,
};
`;

// API Integration test example
const apiIntegrationTest = `
const request = require('supertest');
const app = require('../../server');

describe('Auth API Integration Tests', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register new user with valid data', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'New User',
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          role: 'User',
        });

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body.email).toBe('newuser@example.com');
    });

    it('should reject weak password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'weak',
          role: 'User',
        });

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('feedback');
    });

    it('should reject duplicate email', async () => {
      const userData = {
        name: 'Test User',
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
        role: 'User',
      };

      // First registration
      await request(app).post('/api/v1/auth/register').send(userData);

      // Second registration with same email
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData);

      expect(response.statusCode).toBe(409);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with correct credentials', async () => {
      // Register first
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Login Test',
          email: 'login@example.com',
          password: 'SecurePass123!',
          role: 'User',
        });

      // Then login
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'SecurePass123!',
        });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('token');
    });

    it('should reject incorrect password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.statusCode).toBe(400);
    });
  });
});
`;

module.exports = {
  jestConfig,
  tokenManagerTest,
  rbacTest,
  testUtilities,
  apiIntegrationTest,
};
