const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Ruta raíz para verificar que la aplicación está funcionando
app.get('/', (req, res) => {
    res.send('Bienvenido a la aplicación de integración con Mercado Libre!');
});

app.get('/auth', (req, res) => {
    const authURL = `https://auth.mercadolibre.com/authorization?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}`;
    res.redirect(authURL);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;

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
        res.send('Authorization successful!');
    } catch (error) {
        res.status(500).send('Error during authorization');
    }
});

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});
