// IMPORTANT: Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyC7ozNjYkUajQbRaLYnWtAz2KcHjW6pNQE",
  authDomain: "stockly-22828.firebaseapp.com",
  projectId: "stockly-22828",
  storageBucket: "stockly-22828.firebasestorage.app",
  messagingSenderId: "570984416141",
  appId: "1:570984416141:web:aca7ad591c1a90e79af3c4"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
