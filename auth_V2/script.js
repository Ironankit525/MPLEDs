// State Management
let currentView = 'login';
let showPassword = false;

// Auth Configurations
const GOOGLE_CLIENT_ID = '1018439057287-lu1i2oai77bidbn49ot5o0rmfe3ub8ui.apps.googleusercontent.com';


// DOM Elements
const loginView = document.getElementById('login-view');
const signupView = document.getElementById('signup-view');
const forgotPasswordView = document.getElementById('forgot-password-view');
const verifyCodeView = document.getElementById('verify-code-view');
const signupVerifyView = document.getElementById('signup-verify-view');
const passwordInput = document.getElementById('signup-password');
const strengthContainer = document.getElementById('strength-container');
const bars = document.querySelectorAll('.bar');
const checkItems = document.querySelectorAll('.check-item');

// Inline Lottie Animation Data to bypass CORS issues in local environment
const eyeToggleData = { "v": "5.6.5", "fr": 30, "ip": 0, "op": 25, "w": 32, "h": 32, "nm": "visibility-V2", "ddd": 0, "assets": [], "layers": [{ "ddd": 0, "ind": 1, "ty": 4, "nm": "cross line", "sr": 1, "ks": { "o": { "a": 0, "k": 100, "ix": 11 }, "r": { "a": 0, "k": 0, "ix": 10 }, "p": { "a": 0, "k": [16, 16, 0], "ix": 2 }, "a": { "a": 0, "k": [12, 12, 0], "ix": 1 }, "s": { "a": 0, "k": [100, 100, 100], "ix": 6 } }, "ao": 0, "shapes": [{ "ty": "gr", "it": [{ "ty": "gr", "it": [{ "ind": 0, "ty": "sh", "ix": 1, "ks": { "a": 0, "k": { "i": [[0, 0], [0, 0]], "o": [[0, 0], [0, 0]], "v": [[-10, -9.75], [10, 9.75]], "c": false }, "ix": 2 }, "nm": "Path 1", "mn": "ADBE Vector Shape - Group", "hd": false }, { "ty": "st", "c": { "a": 0, "k": [0, 0, 0, 1], "ix": 3 }, "o": { "a": 0, "k": 100, "ix": 4 }, "w": { "a": 0, "k": 2, "ix": 5 }, "lc": 2, "lj": 1, "ml": 10, "bm": 0, "nm": "Stroke 1", "mn": "ADBE Vector Graphic - Stroke", "hd": false }, { "ty": "tr", "p": { "a": 0, "k": [12, 11.75], "ix": 2 }, "a": { "a": 0, "k": [0, 0], "ix": 1 }, "s": { "a": 0, "k": [100, 100], "ix": 3 }, "r": { "a": 0, "k": 0, "ix": 6 }, "o": { "a": 0, "k": 100, "ix": 7 }, "sk": { "a": 0, "k": 0, "ix": 4 }, "sa": { "a": 0, "k": 0, "ix": 5 }, "nm": "Transform" }], "nm": "Group 1", "np": 2, "cix": 2, "bm": 0, "ix": 1, "mn": "ADBE Vector Group", "hd": false }, { "ty": "gr", "it": [{ "ind": 0, "ty": "sh", "ix": 1, "ks": { "a": 0, "k": { "i": [[0, 0], [0, 0]], "o": [[0, 0], [0, 0]], "v": [[-10, -9.75], [10, 9.75]], "c": false }, "ix": 2 }, "nm": "Path 1", "mn": "ADBE Vector Shape - Group", "hd": false }, { "ty": "st", "c": { "a": 0, "k": [1, 1, 1, 1], "ix": 3 }, "o": { "a": 0, "k": 100, "ix": 4 }, "w": { "a": 0, "k": 2, "ix": 5 }, "lc": 1, "lj": 1, "ml": 10, "bm": 0, "nm": "Stroke 1", "mn": "ADBE Vector Graphic - Stroke", "hd": false }, { "ty": "tr", "p": { "a": 0, "k": [13, 10.75], "ix": 2 }, "a": { "a": 0, "k": [0, 0], "ix": 1 }, "s": { "a": 0, "k": [100, 100], "ix": 3 }, "r": { "a": 0, "k": 0, "ix": 6 }, "o": { "a": 0, "k": 100, "ix": 7 }, "sk": { "a": 0, "k": 0, "ix": 4 }, "sa": { "a": 0, "k": 0, "ix": 5 }, "nm": "Transform" }], "nm": "Group 2", "np": 2, "cix": 2, "bm": 0, "ix": 2, "mn": "ADBE Vector Group", "hd": false }, { "ty": "tm", "s": { "a": 0, "k": 0, "ix": 1 }, "e": { "a": 1, "k": [{ "i": { "x": [0.223], "y": [1] }, "o": { "x": [0.588], "y": [0] }, "t": 0, "s": [0] }, { "t": 25, "s": [100] }], "ix": 2 }, "o": { "a": 0, "k": 0, "ix": 3 }, "m": 1, "ix": 3, "nm": "Trim Paths 1", "mn": "ADBE Vector Filter - Trim", "hd": false }, { "ty": "tr", "p": { "a": 0, "k": [12.5, 11.25], "ix": 2 }, "a": { "a": 0, "k": [12.5, 11.25], "ix": 1 }, "s": { "a": 0, "k": [100, 100], "ix": 3 }, "r": { "a": 0, "k": 0, "ix": 6 }, "o": { "a": 0, "k": 100, "ix": 7 }, "sk": { "a": 0, "k": 0, "ix": 4 }, "sa": { "a": 0, "k": 0, "ix": 5 }, "nm": "Transform" }], "nm": "Line", "np": 3, "cix": 2, "bm": 0, "ix": 1, "mn": "ADBE Vector Group", "hd": false }], "ip": 0, "op": 25, "st": 0, "bm": 0 }, { "ddd": 0, "ind": 2, "ty": 4, "nm": "eye", "sr": 1, "ks": { "o": { "a": 0, "k": 100, "ix": 11 }, "r": { "a": 0, "k": 0, "ix": 10 }, "p": { "a": 0, "k": [16, 16, 0], "ix": 2 }, "a": { "a": 0, "k": [12, 12, 0], "ix": 1 }, "s": { "a": 1, "k": [{ "i": { "x": [0.502, 0.502, 0.667], "y": [1, 1, 1] }, "o": { "x": [0.499, 0.499, 0.333], "y": [0, 0, 0] }, "t": 0, "s": [100, 100, 100] }, { "t": 10, "s": [90, 90, 100] }], "ix": 6 } }, "ao": 0, "shapes": [{ "ty": "gr", "it": [{ "ind": 0, "ty": "sh", "ix": 1, "ks": { "a": 0, "k": { "i": [[-1.657, 0], [0, -1.657], [1.657, 0], [0, 1.657]], "o": [[1.657, 0], [0, 1.657], [-1.657, 0], [0, -1.657]], "v": [[0, -3], [3, 0], [0, 3], [-3, 0]], "c": true }, "ix": 2 }, "nm": "Path 1", "mn": "ADBE Vector Shape - Group", "hd": false }, { "ty": "st", "c": { "a": 0, "k": [0, 0, 0, 1], "ix": 3 }, "o": { "a": 0, "k": 100, "ix": 4 }, "w": { "a": 0, "k": 2, "ix": 5 }, "lc": 2, "lj": 2, "bm": 0, "nm": "Stroke 1", "mn": "ADBE Vector Graphic - Stroke", "hd": false }, { "ty": "tr", "p": { "a": 0, "k": [12, 12], "ix": 2 }, "a": { "a": 0, "k": [0, 0], "ix": 1 }, "s": { "a": 0, "k": [100, 100], "ix": 3 }, "r": { "a": 0, "k": 0, "ix": 6 }, "o": { "a": 0, "k": 100, "ix": 7 }, "sk": { "a": 0, "k": 0, "ix": 4 }, "sa": { "a": 0, "k": 0, "ix": 5 }, "nm": "Transform" }], "nm": "Group 1", "np": 2, "cix": 2, "bm": 0, "ix": 1, "mn": "ADBE Vector Group", "hd": false }, { "ty": "gr", "it": [{ "ind": 0, "ty": "sh", "ix": 1, "ks": { "a": 0, "k": { "i": [[0, 0], [-7, 0], [0, 0], [7, 0]], "o": [[0, 0], [7, 0], [0, 0], [-7, 0]], "v": [[-11, 0], [0, -8], [11, 0], [0, 8]], "c": true }, "ix": 2 }, "nm": "Path 1", "mn": "ADBE Vector Shape - Group", "hd": false }, { "ty": "st", "c": { "a": 0, "k": [0, 0, 0, 1], "ix": 3 }, "o": { "a": 0, "k": 100, "ix": 4 }, "w": { "a": 0, "k": 2, "ix": 5 }, "lc": 2, "lj": 2, "bm": 0, "nm": "Stroke 1", "mn": "ADBE Vector Graphic - Stroke", "hd": false }, { "ty": "tr", "p": { "a": 0, "k": [12, 12], "ix": 2 }, "a": { "a": 0, "k": [0, 0], "ix": 1 }, "s": { "a": 0, "k": [100, 100], "ix": 3 }, "r": { "a": 0, "k": 0, "ix": 6 }, "o": { "a": 0, "k": 100, "ix": 7 }, "sk": { "a": 0, "k": 0, "ix": 4 }, "sa": { "a": 0, "k": 0, "ix": 5 }, "nm": "Transform" }], "nm": "Group 2", "np": 2, "cix": 2, "bm": 0, "ix": 2, "mn": "ADBE Vector Group", "hd": false }], "ip": 0, "op": 25, "st": 0, "bm": 0 }], "markers": [] };

// Lottie Animation Initialization
let eyeAnim = lottie.loadAnimation({
    container: document.getElementById('lottie-eye'),
    renderer: 'svg',
    loop: false,
    autoplay: false,
    animationData: eyeToggleData
});

let loginEyeAnim = lottie.loadAnimation({
    container: document.getElementById('lottie-eye-login'),
    renderer: 'svg',
    loop: false,
    autoplay: false,
    animationData: eyeToggleData
});

eyeAnim.setSpeed(2.5);
loginEyeAnim.setSpeed(2.5);

// View Switching Logic (Hash-based)
async function syncView() {
    const hash = window.location.hash;
    let targetView, newViewId;

    if (hash === '#signup') {
        targetView = signupView;
        newViewId = 'signup';
    } else if (hash === '#forgot-password') {
        targetView = forgotPasswordView;
        newViewId = 'forgot-password';
    } else if (hash === '#verify-code') {
        targetView = verifyCodeView;
        newViewId = 'verify-code';
    } else if (hash === '#signup-verify') {
        targetView = signupVerifyView;
        newViewId = 'signup-verify';
    } else {
        targetView = loginView;
        newViewId = 'login';
    }

    const currentParams = getCurrentViewParams();
    const oldView = currentParams.view;

    // If we're already on the correct view and it's visible, do nothing
    // (This helps avoid unnecessary transitions on initial load if logic matches)
    if (currentView === newViewId && !targetView.classList.contains('hidden')) {
        return;
    }

    // Immediate switch on initial load (if oldView is already hidden)
    if (oldView.classList.contains('hidden') && targetView.classList.contains('hidden')) {
        oldView.classList.add('hidden');
        targetView.classList.remove('hidden');
        currentView = newViewId;
        return;
    }

    // Transition Logic
    oldView.classList.add('fade-out');

    // Wait for fade out
    setTimeout(() => {
        oldView.classList.add('hidden');
        targetView.classList.remove('hidden');
        targetView.classList.add('fade-out'); // Start hidden

        // Force reflow
        void targetView.offsetWidth;

        requestAnimationFrame(() => {
            targetView.classList.remove('fade-out');
            currentView = newViewId;
        });
    }, 300); // Match CSS transition duration
}

function showSignup() {
    window.location.hash = 'signup';
}

function showLogin() {
    window.location.hash = 'login';
}

function showForgotPassword() {
    console.log('Switching to forgot password view');
    window.location.hash = 'forgot-password';
}

function showVerifyCode(email) {
    document.getElementById('verify-email-display').textContent = email;
    window.location.hash = 'verify-code';
}

function showSignupVerify(email) {
    const displayElement = document.getElementById('signup-verify-email-display');
    if (displayElement) {
        displayElement.textContent = email;
    }
    window.location.hash = 'signup-verify';
}

function getCurrentViewParams() {
    if (currentView === 'signup') return { view: signupView, id: 'signup' };
    if (currentView === 'forgot-password') return { view: forgotPasswordView, id: 'forgot-password' };
    if (currentView === 'verify-code') return { view: verifyCodeView, id: 'verify-code' };
    if (currentView === 'signup-verify') return { view: signupVerifyView, id: 'signup-verify' };
    return { view: loginView, id: 'login' };
}

// Password Validation
function validatePassword() {
    const password = passwordInput.value;

    if (password.length > 0) {
        if (!strengthContainer.classList.contains('visible')) {
            strengthContainer.classList.add('visible');

            // Continuous scroll to bottom during the 0.5s expansion animation
            console.log('Dropdown appearing, starting continuous scroll to bottom...');

            const startTime = Date.now();
            const duration = 600; // slightly more than 500ms transition

            function continuousScroll() {
                const now = Date.now();
                // Scroll to absolute bottom
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });

                if (now - startTime < duration) {
                    requestAnimationFrame(continuousScroll);
                }
            }

            requestAnimationFrame(continuousScroll);
        }
    } else {
        strengthContainer.classList.remove('visible');
    }

    const checks = {
        minChars: password.length >= 8,
        hasLower: /[a-z]/.test(password),
        hasUpper: /[A-Z]/.test(password),
        hasNumber: /\d/.test(password),
        hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    let validCount = 0;

    // Update Checklist & Bars
    Object.keys(checks).forEach((key, index) => {
        const isValid = checks[key];
        const item = checkItems[index];

        if (isValid) {
            validCount++;
            item.classList.add('valid');
            item.classList.remove('invalid');
            item.querySelector('.icon-check').classList.remove('hidden');
            item.querySelector('.icon-cross').classList.add('hidden');
        } else {
            item.classList.add('invalid');
            item.classList.remove('valid');
            item.querySelector('.icon-check').classList.add('hidden');
            item.querySelector('.icon-cross').classList.remove('hidden');
        }
    });

    // Update Progress Bars
    strengthContainer.classList.remove('lvl-1', 'lvl-2', 'lvl-3', 'lvl-4', 'lvl-5');
    if (validCount > 0) {
        strengthContainer.classList.add(`lvl-${validCount}`);
    }

    return validCount;
}

// Google Login Integration
function handleGoogleLogin() {
    if (!window.google || !window.google.accounts) {
        alert("Google Sign-In script not loaded yet. Please check your internet connection.");
        return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
        callback: async (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
                try {
                    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                        headers: { 'Authorization': `Bearer ${tokenResponse.access_token}` }
                    });
                    const userInfo = await response.json();
                    if (userInfo.email) {
                        alert(`Successfully signed in as ${userInfo.name} (${userInfo.email})`);
                        document.querySelector('#login-email').value = userInfo.email;
                    }
                } catch (error) {
                    console.error('Error fetching user info:', error);
                    alert('Failed to get user details.');
                }
            }
        },
        error_callback: (error) => {
            console.error('Google Sign-In Error:', error);
        }
    });

    client.requestAccessToken();
}







// Form Handlers
function handleLoginSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;

    const isEmailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pass);
    if (isEmailFormat) {
        alert("Password cannot be an email address.");
        return;
    }

    console.log('Login attempt:', { email, pass });
    alert(`Attempting login for: ${email}`);
}

function handleForgotPasswordSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('forgot-email').value;
    console.log('Forgot password request:', { email });
    // alert(`Reset link sent to: ${email}`);
    showVerifyCode(email);
}

function handleVerifySubmit(event) {
    event.preventDefault();
    const inputs = document.querySelectorAll('#verify-code-view .otp-input');
    let code = '';
    inputs.forEach(input => code += input.value);

    if (code.length === 4) {
        alert(`Code verified: ${code}. Redirecting to login...`);
        showLogin();
    } else {
        alert('Please enter the complete 4-digit code.');
    }
}

function handleSignupVerifySubmit(event) {
    event.preventDefault();
    const inputs = document.querySelectorAll('#signup-verify-view .otp-input');
    let code = '';
    inputs.forEach(input => code += input.value);

    if (code.length === 4) {
        alert(`Account created and verified! Code: ${code}. Redirecting to login...`);
        showLogin();
    } else {
        alert('Please enter the complete 4-digit code.');
    }
}

function handleSignupContinue() {
    const email = document.getElementById('signup-email').value;
    const firstName = document.getElementById('signup-firstname').value;
    const lastName = document.getElementById('signup-lastname').value;
    const password = passwordInput.value;
    const validCount = validatePassword();
    const isEmailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(password);

    if (isEmailFormat) {
        alert("Password cannot be an email address.");
        return;
    }

    if (validCount >= 3 && email && firstName && lastName) {
        // alert("Registration Successful! Redirecting to login...");
        showSignupVerify(email);
    } else {
        if (!email || !firstName || !lastName) {
            alert("Please fill in all fields.");
        } else {
            alert("Please ensure your password meets at least 3 requirements.");
        }
    }
}

function togglePasswordVisibility() {
    showPassword = !showPassword;

    // Animate Text Switch
    passwordInput.classList.add('text-transparent');

    setTimeout(() => {
        passwordInput.type = showPassword ? "text" : "password";
        passwordInput.classList.remove('text-transparent');
    }, 150); // Wait for fade out

    if (showPassword) {
        eyeAnim.setDirection(1);
        eyeAnim.play();
    } else {
        eyeAnim.setDirection(-1);
        eyeAnim.play();
    }
}

let showLoginPassword = false;
function toggleLoginPasswordVisibility() {
    const loginPassInput = document.getElementById('login-pass');
    showLoginPassword = !showLoginPassword;

    // Animate Text Switch
    loginPassInput.classList.add('text-transparent');

    setTimeout(() => {
        loginPassInput.type = showLoginPassword ? "text" : "password";
        loginPassInput.classList.remove('text-transparent');
    }, 150); // Wait for fade out

    if (showLoginPassword) {
        loginEyeAnim.setDirection(1);
        loginEyeAnim.play();
    } else {
        loginEyeAnim.setDirection(-1);
        loginEyeAnim.play();
    }
}

// Initialize Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    passwordInput.addEventListener('input', validatePassword);
    const loginPassInput = document.getElementById('login-pass');

    // Prevent space in password (Signup)
    passwordInput.classList.add('password-input'); // Add transition class
    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
            e.preventDefault();
        }
    });

    // Prevent space in password (Login)
    loginPassInput.classList.add('password-input'); // Add transition class
    loginPassInput.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
            e.preventDefault();
        }
    });

    // Sync view on initial load
    syncView();

    // OTP Input Logic
    const otpInputs = document.querySelectorAll('.otp-input');
    otpInputs.forEach((input, index) => {
        // Allow digits only
        input.addEventListener('input', (e) => {
            if (e.target.value.length > 1) {
                e.target.value = e.target.value.slice(0, 1);
            }
            if (e.target.value.match(/[^0-9]/)) {
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
            }

            if (e.target.value !== '' && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });

        // Backspace support
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
                otpInputs[index - 1].focus();
            }
        });

        // Handle paste
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const data = e.clipboardData.getData('text').slice(0, 4).replace(/[^0-9]/g, '');
            if (data) {
                data.split('').forEach((char, i) => {
                    if (otpInputs[index + i]) {
                        otpInputs[index + i].value = char;
                        if (index + i < otpInputs.length - 1) {
                            otpInputs[index + i + 1].focus();
                        }
                    }
                });
            }
        });
    });

    // Listen for browser back/forward buttons
    window.addEventListener('hashchange', syncView);
});
