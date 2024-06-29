const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const sequelize = require('./database');
const Token = require('./models/Token');
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Sincronizar modelos con la base de datos
sequelize.sync().then(() => {
    console.log('Database synchronized');
}).catch(err => {
    console.error('Error synchronizing the database:', err);
});

// Ruta raíz para verificar que la aplicación está funcionando
app.get('/', (req, res) => {
    res.send('Bienvenido a la aplicación de integración con Mercado Libre!');
});

// Ruta para iniciar la autorización
app.get('/auth', (req, res) => {
    const authURL = `https://auth.mercadolibre.com/authorization?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}`;
    res.redirect(authURL);
});

// Ruta de callback para manejar el token de autorización
app.get('/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send('Authorization code not provided');
    }

    try {
        const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
            grant_type: 'authorization_code',
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            code: code,
            redirect_uri: process.env.REDIRECT_URI
        });

        const { access_token, refresh_token } = response.data;

        // Guarda tokens en la base de datos
        await Token.create({ access_token, refresh_token });

        // Muestra una página de confirmación
        res.send('<h1>Authorization successful!</h1><p>Access token and refresh token received and stored in the database.</p>');
    } catch (error) {
        console.error('Error during authorization', error.response ? error.response.data : error.message);
        res.status(500).send('Error during authorization');
    }
});

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});
