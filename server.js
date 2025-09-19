import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import admin from 'firebase-admin';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Firebase Admin SDK
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  console.error("Failed to initialize Firebase Admin SDK. Check your FIREBASE_SERVICE_ACCOUNT_KEY in the .env file.");
  process.exit(1);
}

const CLIENT_ID = process.env.1416153025180991555;
const CLIENT_SECRET = process.env.-F_yRNc-zGlb3UaoYEoao0OdyqwCNTkx;
const GUILD_ID = process.env.1412103251574394900;

// Parse the comma-separated string of required role IDs into an array
const REQUIRED_ROLE_IDS = process.env.1412131096690430074 ? process.env.1412136245324419152.split(',').map(id => id.trim()) : [];

const REDIRECT_URI = 'http://localhost:3000/auth/discord/callback';

// Set up a simple route to start the OAuth2 flow
app.get('/auth/discord', (req, res) => {
  const scope = 'identify guilds';
  const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${scope}`;
  res.redirect(url);
});

// The callback route that Discord redirects to
app.get('/auth/discord/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('No code provided.');
  }

  try {
    // Exchange the code for an access token
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
      scope: 'identify guilds'
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    const { access_token } = tokenResponse.data;

    // Get the user's Discord ID
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const discordId = userResponse.data.id;
    const discordUsername = userResponse.data.username;
    const discordAvatar = userResponse.data.avatar;

    // Check if the user is in the required guild and has the required role
    const guildMemberResponse = await axios.get(`https://discord.com/api/v10/users/@me/guilds/${GUILD_ID}/member`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const roles = guildMemberResponse.data.roles;
    
    // Check if the user has any of the required roles
    const hasRequiredRole = REQUIRED_ROLE_IDS.some(roleId => roles.includes(roleId));
    
    if (!hasRequiredRole) {
      return res.status(403).send('You do not have the required role to access this panel.');
    }

    // Create a custom Firebase token for the user
    const customToken = await admin.auth().createCustomToken(discordId, {
        role: 'admin',
        discordId: discordId,
        username: discordUsername,
        avatar: discordAvatar
    });

    // Redirect the user back to the frontend with the custom token
    // The frontend will then use this token to sign in with Firebase
    res.redirect(`/?token=${customToken}`);

  } catch (error) {
    console.error('Discord OAuth Error:', error.response ? error.response.data : error.message);
    res.status(500).send('Authentication failed. Check server logs.');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
