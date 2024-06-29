const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Token = sequelize.define('Token', {
    access_token: {
        type: DataTypes.STRING,
        allowNull: false
    },
    refresh_token: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = Token;
