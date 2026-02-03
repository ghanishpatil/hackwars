/**
 * Environment Variable Validation
 * 
 * Validates that all required environment variables are set on startup.
 * Fails fast with helpful error messages if configuration is missing.
 */

const REQUIRED_VARS = {
  production: [
    'PORT',
    'NODE_ENV',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_STORAGE_BUCKET',
    'CORS_ORIGINS',
    'MATCH_ENGINE_URL',
    'MATCH_ENGINE_SECRET',
  ],
  development: [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL',
  ],
};

/**
 * Validate environment variables based on NODE_ENV.
 * Throws error if any required variables are missing.
 */
export function validateEnvironment() {
  const env = process.env.NODE_ENV || 'development';
  const required = env === 'production' ? REQUIRED_VARS.production : REQUIRED_VARS.development;
  
  const missing = [];
  
  for (const varName of required) {
    if (!process.env[varName] || process.env[varName].trim() === '') {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    const error = new Error(
      `Missing required environment variables:\n  - ${missing.join('\n  - ')}\n\n` +
      `Please check your .env file or environment configuration.\n` +
      `See .env.example for required variables.`
    );
    error.code = 'MISSING_ENV_VARS';
    throw error;
  }
  
  // Production-specific validations
  if (env === 'production') {
    validateProductionConfig();
  }
  
  console.log(`✓ Environment validation passed (${env} mode)`);
}

/**
 * Additional validation for production environment.
 * CORS localhost is allowed for development; for final production set CORS_ORIGINS to your real domain(s).
 */
function validateProductionConfig() {
  const corsOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const hasLocalhost = corsOrigins.some(origin =>
    origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('0.0.0.0')
  );
  if (hasLocalhost) {
    console.warn(
      '⚠ CORS_ORIGINS contains localhost. For final production, set CORS_ORIGINS to your production domain(s) only.'
    );
  }

  // Validate Firebase private key format
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
  if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
    throw new Error(
      'SECURITY ERROR: FIREBASE_PRIVATE_KEY appears to be invalid.\n' +
      'It should contain "-----BEGIN PRIVATE KEY-----" and "-----END PRIVATE KEY-----"'
    );
  }
  
  // Validate match engine secret is strong
  const secret = process.env.MATCH_ENGINE_SECRET || '';
  if (secret.length < 32) {
    throw new Error(
      'SECURITY ERROR: MATCH_ENGINE_SECRET must be at least 32 characters long.\n' +
      'Generate a strong random secret for production.'
    );
  }
  
  console.log('✓ Production security validation passed');
}

/**
 * Get validated configuration object.
 * Call validateEnvironment() first.
 */
export function getValidatedConfig() {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    },
    
    cors: {
      origins: (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || 'http://localhost:5173')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    },
    
    matchEngine: {
      url: process.env.MATCH_ENGINE_URL || 'http://localhost:7000',
      secret: process.env.MATCH_ENGINE_SECRET || '',
    },
    
    limits: {
      bodyLimit: parseInt(process.env.BODY_LIMIT || '102400', 10),
      maxConcurrentMatches: parseInt(process.env.MAX_CONCURRENT_MATCHES || '50', 10),
      maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE_PER_DIFFICULTY || '200', 10),
    },
  };
}
