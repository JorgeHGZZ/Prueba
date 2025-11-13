# Firebase Login Demo

This project is a simple login interface using Firebase for user authentication. It allows users to log in with their email and password, register a new account, or sign in using their Google account.

## Project Structure

```
firebase-login-demo
├── public
│   ├── login.html        # HTML structure for the login interface
│   ├── login.css         # CSS styles for the login interface
│   └── login.js          # JavaScript code for handling user authentication
├── src
│   └── firebase
│       └── index.js      # Firebase configuration and initialization code
├── package.json           # npm configuration file
├── .gitignore             # Specifies files to be ignored by Git
└── README.md              # Documentation for the project
```

## Getting Started

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd firebase-login-demo
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Open the `public/login.html` file in your browser** to view the login interface.

## Features

- User authentication with email and password.
- User registration for new accounts.
- Google sign-in option.
- Error handling for authentication processes.

## Firebase Configuration

The Firebase configuration is located in `src/firebase/index.js`. Make sure to replace the placeholder values with your actual Firebase project credentials.

## Notes

- Ensure that you have set up your Firebase project correctly and enabled the necessary authentication methods in the Firebase console.
- For any issues, check the browser console for error messages.