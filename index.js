const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const mysql = require('mysql2');
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configuración de la conexión a la base de datos usando un pool
// de conexiones para manejar múltiples conexiones de manera eficiente.
const connection = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Ruta raíz para verificar que la aplicación está funcionando correctamente.
app.get('/', (req, res) => {
    res.send('Bienvenido a la aplicación de integración con Mercado Libre!');
});

// Ruta para iniciar la autorización en Mercado Libre.
app.get('/auth', (req, res) => {
    const authURL = `https://auth.mercadolibre.com.mx/authorization?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}`;
    res.redirect(authURL);
});

// Ruta de callback para manejar el token de autorización.
app.get('/codeback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send('Authorization code not provided');
    }

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

        const { access_token, refresh_token, expires_in, user_id, scope, token_type } = response.data;

        // Verificar si el user_id ya existe en la base de datos
        const checkQuery = 'SELECT * FROM tokens WHERE user_id = ?';
        connection.query(checkQuery, [user_id], (checkError, checkResults) => {
            if (checkError) {
                return res.status(500).send('Error checking user_id in the database');
            }

            if (checkResults.length > 0) {
                return res.send('<h1>Authorization successful!</h1><p>Access token and refresh token already stored in the database.</p>');
            }

            // Guarda tokens en la base de datos, incluyendo el campo created_at
            const newToken = {
                user_id,
                access_token,
                refresh_token,
                expires_in,
                scope,
                token_type,
                created_at: new Date() // Establece el valor de created_at
            };

            const query = 'INSERT INTO tokens SET ?';
            connection.query(query, newToken, (error, results) => {
                if (error) {
                    return res.status(500).send('Error storing tokens in the database');
                }

                // Muestra una página de confirmación
                res.send('<h1>Authorization successful!</h1><p>Access token and refresh token received and stored in the database.</p>');
            });
        });
    } catch (error) {
        res.status(500).send(`<h1>Error during authorization</h1><p>${error.response ? error.response.data : error.message}</p>`);
    }
});

// Ruta para obtener el access_token vigente para un user_id específico.
app.get('/token/:user_id', async (req, res) => {
    const { user_id } = req.params;

    // Verificar si el user_id existe en la base de datos
    const checkQuery = 'SELECT * FROM tokens WHERE user_id = ?';
    connection.query(checkQuery, [user_id], async (checkError, checkResults) => {
        if (checkError) {
            return res.status(500).send('Error checking user_id in the database');
        }

        if (checkResults.length === 0) {
            return res.status(404).send('User ID not found in the database');
        }

        const tokenData = checkResults[0];
        const { access_token, refresh_token, expires_in, created_at } = tokenData;
        const tokenAge = (Date.now() - new Date(created_at).getTime()) / 1000;

        // Verificar si el token aún es válido
        if (tokenAge < expires_in) {
            return res.json({ access_token });
        }

        // Si el token ha expirado, obtener uno nuevo usando el refresh_token
        try {
            const response = await axios.post('https://api.mercadolibre.com/oauth/token', null, {
                params: {
                    grant_type: 'refresh_token',
                    client_id: process.env.CLIENT_ID,
                    client_secret: process.env.CLIENT_SECRET,
                    refresh_token: refresh_token
                },
                headers: {
                    'content-type': 'application/x-www-form-urlencoded'
                }
            });

            const newTokenData = response.data;
            const { access_token: new_access_token, refresh_token: new_refresh_token, expires_in: new_expires_in } = newTokenData;

            // Actualizar los tokens en la base de datos
            const updateQuery = 'UPDATE tokens SET access_token = ?, refresh_token = ?, expires_in = ?, created_at = NOW() WHERE user_id = ?';
            connection.query(updateQuery, [new_access_token, new_refresh_token, new_expires_in, user_id], (updateError) => {
                if (updateError) {
                    return res.status(500).send('Error updating tokens in the database');
                }

                res.json({ access_token: new_access_token });
            });
        } catch (error) {
            res.status(500).send(`Error refreshing token: ${error.response ? error.response.data : error.message}`);
        }
    });
});

// Inicia el servidor en el puerto especificado.
app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});
