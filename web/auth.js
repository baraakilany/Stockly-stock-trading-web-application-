// --- AUTHENTICATION FUNCTIONS ---

/**
 * Handles user registration using Firebase Auth.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 * @param {string} fullName - The user's full name.
 * @param {string|null} location - The user's detected location.
 */
async function handleRegister(email, password, fullName, location) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        const isAdmin = false; 

        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            fullName: fullName,
            email: email,
            cash: 100000, // Starting cash for new users
            isPro: false,
            isAdmin: isAdmin,
            portfolio: [],
            wishlist: [],
            location: location || 'Unknown' // Save the detected location
        });

        showAppToast(`Welcome, ${fullName}! Your account has been created.`, 'success');
        
    } catch (error) {
        console.error("Registration Error:", error);
        showAppToast(`Error: ${error.message}`, 'error');
    }
}

/**
 * Handles user login using Firebase Auth.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 */
async function handleLogin(email, password) {
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        console.error("Login Error:", error);
        showAppToast(`Error: ${error.message}`, 'error');
    }
}

/**
 * Handles user logout.
 */
async function handleLogout() {
    try {
        await auth.signOut();
        showAppToast('You have been successfully logged out.', 'info');
    } catch (error) {
        console.error("Logout Error:", error);
        showAppToast(`Error: ${error.message}`, 'error');
    }
}

/**
 * Handles updating the user's password in Firebase Auth.
 * @param {string} newPassword - The new password.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
async function handleUpdatePassword(newPassword) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("No user is signed in.");
        }
        await user.updatePassword(newPassword);
        return true;
    } catch (error) {
        console.error("Password Update Error:", error);
        showAppToast(`Error: ${error.message}. Please log out and log back in to update your password.`, 'error');
        return false;
    }
}
