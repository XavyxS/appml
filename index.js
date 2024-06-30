const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const mysql = require('mysql2');
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configuración de la conexión a la base de datos
const connection = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Ruta raíz para verificar que la aplicación está funcionando
app.get('/', (req, res) => {
    console.log('Root URL accessed');
    res.send('Bienvenido a la aplicación de integración con Mercado Libre!');
});

// Ruta para iniciar la autorización
app.get('/auth', (req, res) => {
    console.log('Redirecting to Mercado Libre authorization URL');
    const authURL = `https://auth.mercadolibre.com.mx/authorization?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}`;
    res.redirect(authURL);
});

// Ruta de callback para manejar el token de autorización
app.get('/codeback', async (req, res) => {
    console.log('/codeback endpoint hit');
    const { code } = req.query;

    if (!code) {
        console.error('Authorization code not provided');
        return res.status(400).send('Authorization code not provided');
    }

    console.log(`Authorization code received: ${code}`);

    try {
        const response = await axios.post('https://api.mercadolibre.com/oauth/token', null, {
            params: {
                grant_type: 'authorization_code',
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                code: code,
                redirect_uri: process.env.REDIRECT_URI
            },
            headers: {
                'content-type': 'application/x-www-form-urlencoded'
            }
        });

        console.log('API response received:', response.data);

        const { access_token, refresh_token, expires_in, user_id, scope, token_type } = response.data;

        // Verificar si el user_id ya existe en la base de datos
        const checkQuery = 'SELECT * FROM tokens WHERE user_id = ?';
        connection.query(checkQuery, [user_id], (checkError, checkResults) => {
            if (checkError) {
                console.error('Error checking user_id in the database:', checkError.stack);
                return res.status(500).send('Error checking user_id in the database');
            }

            if (checkResults.length > 0) {
                console.log('user_id already exists in the database. Skipping insertion.');
                return res.send('<h1>Authorization successful!</h1><p>Access token and refresh token already stored in the database.</p>');
            }

            // Guarda tokens en la base de datos
            const newToken = {
                user_id,
                access_token,
                refresh_token,
                expires_in,
                scope,
                token_type
            };

            console.log('Token to be stored:', newToken);

            const query = 'INSERT INTO tokens SET ?';
            connection.query(query, newToken, (error, results, fields) => {
                if (error) {
                    console.error('Error storing tokens in the database:', error.stack);
                    return res.status(500).send('Error storing tokens in the database');
                }
                console.log('Tokens stored in the database:', results);

                // Muestra una página de confirmación
                res.send('<h1>Authorization successful!</h1><p>Access token and refresh token received and stored in the database.</p>');
            });
        });
    } catch (error) {
        console.error('Error during authorization', error.response ? error.response.data : error.message);
        res.status(500).send(`<h1>Error during authorization</h1><p>${error.response ? error.response.data : error.message}</p>`);
    }

    console.log('End of codeback function');
});

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});
