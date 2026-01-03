// API Configuration for Quiz Master
// This file handles different environments (local vs production)

const CONFIG = {
    // Automatically detect environment and set correct API URL
    API_URL: (() => {
        const hostname = window.location.hostname;
        
        // Local development
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'https://quiz-master-zoo7.onrender.com';
        }
        
        // Production - uses same domain as frontend
        return window.location.origin;
    })(),
    
    // Token storage key
    TOKEN_KEY: 'quiz_master_token',
    USER_KEY: 'quiz_master_user'
};

// Helper functions for token management
CONFIG.saveAuth = (token, user) => {
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
};

CONFIG.getToken = () => {
    return localStorage.getItem(CONFIG.TOKEN_KEY);
};

CONFIG.getUser = () => {
    const user = localStorage.getItem(CONFIG.USER_KEY);
    return user ? JSON.parse(user) : null;
};

CONFIG.clearAuth = () => {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
};

CONFIG.isAuthenticated = () => {
    return !!CONFIG.getToken();
};

// Helper function for authenticated API calls
CONFIG.fetchWithAuth = async (endpoint, options = {}) => {
    const token = CONFIG.getToken();
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
        ...options,
        headers
    });
    
    // Handle 401/403 - redirect to login
    if (response.status === 401 || response.status === 403) {
        CONFIG.clearAuth();
        window.location.href = '/index.html';
        throw new Error('Authentication required');
    }
    
    return response;
};

// Log configuration in development
if (window.location.hostname === 'localhost') {
    console.log('🔧 Quiz Master Config:', {
        API_URL: CONFIG.API_URL,
        Environment: 'Development'
    });
}
