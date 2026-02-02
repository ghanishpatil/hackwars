/**
 * Frontend Environment Validation
 * 
 * Validates required environment variables for the frontend.
 * Call this early in the application lifecycle.
 */

const REQUIRED_VARS = [
    'VITE_API_URL',
    'VITE_SOCKET_URL',
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
];

/**
 * Validate that all required environment variables are set.
 * Throws error with helpful message if any are missing.
 */
export function validateEnvironment() {
    const missing = [];

    for (const varName of REQUIRED_VARS) {
        const value = import.meta.env[varName];
        if (!value || value.trim() === '' || value === 'undefined') {
            missing.push(varName);
        }
    }

    if (missing.length > 0) {
        const error = new Error(
            `Missing required environment variables:\n  - ${missing.join('\n  - ')}\n\n` +
            `Please check your .env file in the frontend directory.\n` +
            `See .env.example for required variables.\n\n` +
            `If you're running in development, make sure you have a .env file in the frontend directory.`
        );
        throw error;
    }

    console.log('✓ Frontend environment validation passed');
}

/**
 * Get validated configuration.
 * Call validateEnvironment() first.
 */
export function getConfig() {
    return {
        apiUrl: import.meta.env.VITE_API_URL,
        socketUrl: import.meta.env.VITE_SOCKET_URL,
        firebase: {
            apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
            appId: import.meta.env.VITE_FIREBASE_APP_ID,
        },
    };
}
