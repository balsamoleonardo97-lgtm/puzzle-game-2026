/**
 * BACKEND - Puzzle Game Argentina 2026
 * VERSIÓN MEJORADA CON MEJOR DIAGNÓSTICO DE .ENV
 * 
 * INSTALACIÓN:
 * npm install express cors dotenv mercadopago axios
 * EJECUCIÓN:
 * node server.js
 */
 
// =====================================================
// CARGAR .env PRIMERO (LÍNEA 1)
// =====================================================
 
require('dotenv').config();
 
// =====================================================
// DIAGNÓSTICO INICIAL (.env)
// =====================================================
 
console.log('');
console.log('═══════════════════════════════════════════════');
console.log('🔍 DIAGNÓSTICO INICIAL');
console.log('═══════════════════════════════════════════════');
 
const fs = require('fs');
const path = require('path');
 
// Verificar si .env existe
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);
 
console.log('📁 Carpeta actual:', __dirname);
console.log('📄 Archivo .env existe:', envExists ? '✅ SÍ' : '❌ NO');
 
if (!envExists) {
    console.log('');
    console.log('❌ ERROR: El archivo .env NO EXISTE');
    console.log('');
    console.log('SOLUCIONES:');
    console.log('1. Crear archivo .env en la misma carpeta que server.js');
    console.log('2. Copiar el contenido de .env.example');
    console.log('3. Reemplazar TEST-... con tu token real');
    console.log('4. Guardar y ejecutar nuevamente: node server.js');
    console.log('');
    console.log('Archivos en tu carpeta:');
    console.log(fs.readdirSync(__dirname));
    console.log('');
    process.exit(1);
}
 
// Verificar contenido de .env
if (envExists) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    console.log('📋 Archivo .env contiene:');
    const lines = envContent.split('\n').filter(line => line.trim());
    lines.forEach(line => {
        const [key] = line.split('=');
        console.log(`   ✓ ${key}`);
    });
}
 
// Verificar variables necesarias
console.log('');
console.log('🔐 Verificando variables de entorno:');
 
const requiredEnvs = {
    'MERCADO_PAGO_TOKEN': process.env.MERCADO_PAGO_TOKEN,
    'PORT': process.env.PORT,
    'FRONTEND_URL': process.env.FRONTEND_URL,
    'NODE_ENV': process.env.NODE_ENV,
    'ADMIN_KEY': process.env.ADMIN_KEY
};
 
let missingEnv = [];
 
Object.entries(requiredEnvs).forEach(([key, value]) => {
    if (value) {
        const displayValue = key === 'MERCADO_PAGO_TOKEN' 
            ? value.substring(0, 10) + '...' 
            : value;
        console.log(`   ✅ ${key} = ${displayValue}`);
    } else {
        console.log(`   ❌ ${key} = FALTA`);
        missingEnv.push(key);
    }
});
 
if (missingEnv.length > 0) {
    console.log('');
    console.log('❌ ERROR: Faltan variables en .env:');
    missingEnv.forEach(env => {
        console.log(`   - ${env}`);
    });
    console.log('');
    console.log('SOLUCIÓN:');
    console.log('1. Abre .env con editor de texto');
    console.log('2. Verifica que tiene todas las líneas');
    console.log('3. Sin espacios alrededor del =');
    console.log('4. Guarda y vuelve a ejecutar');
    console.log('');
    process.exit(1);
}
 
console.log('');
console.log('✅ Todas las variables están configuradas');
console.log('═══════════════════════════════════════════════');
console.log('');
 
// =====================================================
// IMPORTAR LIBRERÍAS
// =====================================================
 
const express = require('express');
const cors = require('cors');
const MercadoPago = require('mercadopago');
const axios = require('axios');
 
const app = express();
const PORT = process.env.PORT || 3000;
 
// =====================================================
// CONFIGURACIÓN INICIAL
// =====================================================
 
app.use(cors({
    origin: [
        'http://localhost:5500',
        'http://localhost:3000',
        'http://127.0.0.1:5500',
        process.env.FRONTEND_URL || 'http://localhost:5500'
    ],
    credentials: true
}));
 
app.use(express.json());
 
// Configurar Mercado Pago
try {
   ({
        access_token: process.env.MERCADO_PAGO_TOKEN
    });
    console.log('✅ Mercado Pago configurado correctamente');
} catch (error) {
    console.error('❌ Error configurando Mercado Pago:', error.message);
    process.exit(1);
}
 
// =====================================================
// BASE DE DATOS SIMULADA
// =====================================================
 
const gameDatabase = {
    users: new Map(),
    payments: [],
    unlockedBlocks: new Set(),
    specialBlocks: new Set([50, 150, 250, 350, 450]),
    gameState: {
        totalUnlocked: 0,
        lastUnlocker: null,
        createdAt: Date.now()
    }
};
 
// =====================================================
// FUNCIONES AUXILIARES
// =====================================================
 
function getCurrentPrice(unlockedCount) {
    const PRICE_TIERS = [
        { min: 0, max: 100, price: 500 },
        { min: 100, max: 200, price: 1000 },
        { min: 200, max: 300, price: 1500 },
        { min: 300, max: 400, price: 1700 },
        { min: 400, max: 500, price: 1800 },
        { min: 500, max: 600, price: 1800 },
        { min: 600, max: 700, price: 1800 },
        { min: 700, max: 800, price: 1800 },
        { min: 800, max: 900, price: 2000 },
        { min: 900, max: 1024, price: 2000 }
    ];
 
    for (let tier of PRICE_TIERS) {
        if (unlockedCount >= tier.min && unlockedCount < tier.max) {
            return tier.price;
        }
    }
    return 2000;
}
 
function validatePayment(blockIndex, amount, userId) {
    if (blockIndex < 0 || blockIndex >= 1024) {
        return { valid: false, error: 'Índice de bloque inválido' };
    }
 
    if (gameDatabase.unlockedBlocks.has(blockIndex)) {
        return { valid: false, error: 'Este bloque ya fue desbloqueado' };
    }
 
    const expectedPrice = getCurrentPrice(gameDatabase.unlockedBlocks.size);
    if (amount !== expectedPrice) {
        return { valid: false, error: 'Monto incorrecto' };
    }
 
    return { valid: true };
}
 
// =====================================================
// RUTAS DE API
// =====================================================
 
app.get('/api/game-state', (req, res) => {
    try {
        const unlockedArray = Array.from(gameDatabase.unlockedBlocks);
        
        res.json({
            success: true,
            unlockedBlocks: unlockedArray,
            totalUnlocked: gameDatabase.gameState.totalUnlocked,
            totalBlocks: 1024,
            progressPercent: (gameDatabase.gameState.totalUnlocked / 1024) * 100,
            currentPrice: getCurrentPrice(gameDatabase.gameState.totalUnlocked),
            lastUnlocker: gameDatabase.gameState.lastUnlocker,
            createdAt: gameDatabase.gameState.createdAt
        });
    } catch (error) {
        console.error('Error en GET /api/game-state:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
 
app.get('/api/special-blocks', (req, res) => {
    try {
        res.json({
            success: true,
            specialBlocks: Array.from(gameDatabase.specialBlocks)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
 
app.post('/api/create-preference', async (req, res) => {
    try {
        const { blockIndex, amount, currency, method, userId } = req.body;
 
        const validation = validatePayment(blockIndex, amount, userId);
        if (!validation.valid) {
            return res.status(400).json({ 
                success: false, 
                error: validation.error 
            });
        }
 
        const preference = {
            items: [
                {
                    id: `block_${blockIndex}`,
                    title: `Desbloquear Bloque #${blockIndex + 1}`,
                    description: `Argentina 2026 - Rompecabezas`,
                    category_id: 'ar_other',
                    quantity: 1,
                    unit_price: amount / 1000
                }
            ],
            payer: {
                email: 'usuario@example.com'
            },
            external_reference: `${userId}_block_${blockIndex}_${Date.now()}`,
            back_urls: {
                success: `${process.env.FRONTEND_URL || 'http://localhost:5500'}?status=approved&block=${blockIndex}&user=${userId}`,
                failure: `${process.env.FRONTEND_URL || 'http://localhost:5500'}?status=rejected`,
                pending: `${process.env.FRONTEND_URL || 'http://localhost:5500'}?status=pending`
            },
            auto_return: 'approved',
            metadata: {
                blockIndex,
                userId,
                amount,
                currency,
                method
            }
        };
 
        const response = await MercadoPago.preferences.create(preference);
 
        const paymentRecord = {
            preferenceId: response.body.id,
            blockIndex,
            userId,
            amount,
            timestamp: Date.now(),
            status: 'pending'
        };
        gameDatabase.payments.push(paymentRecord);
 
        console.log(`✅ Preferencia creada para usuario ${userId}, bloque ${blockIndex}`);
 
        res.json({
            success: true,
            preferenceId: response.body.id,
            initPoint: response.body.init_point,
            sandboxInitPoint: response.body.sandbox_init_point
        });
 
    } catch (error) {
        console.error('Error en POST /api/create-preference:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});
 
app.post('/api/confirm-payment', async (req, res) => {
    try {
        const { paymentId, blockIndex, userId } = req.body;
 
        if (!paymentId || blockIndex === undefined || !userId) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros inválidos'
            });
        }
 
        let paymentData;
        try {
            const response = await MercadoPago.payment.findById(paymentId);
            paymentData = response.body;
        } catch (error) {
            console.error('Error verificando pago:', error);
            return res.status(400).json({
                success: false,
                error: 'No se pudo verificar el pago'
            });
        }
 
        if (paymentData.status !== 'approved') {
            return res.status(400).json({
                success: false,
                error: 'El pago no fue aprobado',
                status: paymentData.status
            });
        }
 
        if (gameDatabase.unlockedBlocks.has(blockIndex)) {
            return res.status(400).json({
                success: false,
                error: 'Este bloque ya fue desbloqueado'
            });
        }
 
        gameDatabase.unlockedBlocks.add(blockIndex);
        gameDatabase.gameState.totalUnlocked++;
        gameDatabase.gameState.lastUnlocker = {
            blockIndex,
            userId,
            time: new Date().toLocaleString('es-AR'),
            amount: paymentData.transaction_amount
        };
 
        const isSpecial = gameDatabase.specialBlocks.has(blockIndex);
        const isComplete = gameDatabase.gameState.totalUnlocked === 1024;
 
        const paymentRecord = {
            id: paymentId,
            blockIndex,
            userId,
            amount: paymentData.transaction_amount,
            isSpecial,
            status: 'approved',
            timestamp: Date.now()
        };
        gameDatabase.payments.push(paymentRecord);
 
        console.log(`✅ PAGO CONFIRMADO: Usuario ${userId}, Bloque ${blockIndex}, Monto: $${paymentData.transaction_amount}`);
 
        res.json({
            success: true,
            blockIndex,
            isSpecial,
            isComplete,
            message: isSpecial ? 
                '¡BLOQUE ESPECIAL! Ganaste $5.000' : 
                isComplete ? 
                '¡IMAGEN COMPLETA! ¡Ganaste $500.000!' :
                'Bloque desbloqueado',
            totalUnlocked: gameDatabase.gameState.totalUnlocked
        });
 
    } catch (error) {
        console.error('Error en POST /api/confirm-payment:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
 
app.post('/api/webhook', (req, res) => {
    try {
        const { type, data } = req.body;
 
        if (type === 'payment') {
            console.log(`📨 Webhook: Pago ${data.id} - Status: ${data.status}`);
        }
 
        res.json({ success: true });
 
    } catch (error) {
        console.error('Error en webhook:', error);
        res.status(500).json({ success: false });
    }
});
 
app.get('/api/stats', (req, res) => {
    try {
        const completionPercent = (gameDatabase.gameState.totalUnlocked / 1024) * 100;
        const totalRevenue = gameDatabase.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
 
        res.json({
            success: true,
            stats: {
                totalUnlocked: gameDatabase.gameState.totalUnlocked,
                totalBlocks: 1024,
                completionPercent: completionPercent.toFixed(2),
                totalPayments: gameDatabase.payments.length,
                totalRevenue,
                lastUnlocker: gameDatabase.gameState.lastUnlocker,
                gameCreatedAt: new Date(gameDatabase.gameState.createdAt).toLocaleString('es-AR')
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
 
app.get('/api/payments-history', (req, res) => {
    try {
        const adminKey = req.headers['x-admin-key'];
        
        if (adminKey !== process.env.ADMIN_KEY) {
            return res.status(401).json({ success: false, error: 'No autorizado' });
        }
 
        res.json({
            success: true,
            payments: gameDatabase.payments,
            totalPayments: gameDatabase.payments.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
 
app.post('/api/admin/reset-game', (req, res) => {
    try {
        const adminKey = req.headers['x-admin-key'];
        
        if (adminKey !== process.env.ADMIN_KEY) {
            return res.status(401).json({ success: false, error: 'No autorizado' });
        }
 
        gameDatabase.unlockedBlocks = new Set();
        gameDatabase.gameState = {
            totalUnlocked: 0,
            lastUnlocker: null,
            createdAt: Date.now()
        };
        gameDatabase.payments = [];
 
        console.log('🔄 Juego reseteado');
 
        res.json({
            success: true,
            message: 'Juego reseteado exitosamente'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
 
// =====================================================
// MANEJO DE ERRORES
// =====================================================
 
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor' 
    });
});
 
// =====================================================
// INICIAR SERVIDOR
// =====================================================
 
app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('🏆 PUZZLE GAME - SERVIDOR INICIADO');
    console.log('═══════════════════════════════════════════════');
    console.log(`✅ Servidor escuchando en puerto ${PORT}`);
    console.log(`📍 Base URL: http://localhost:${PORT}`);
    console.log(`🔗 Frontend: ${process.env.FRONTEND_URL}`);
    console.log(`💳 Mercado Pago: Configurado`);
    console.log('═══════════════════════════════════════════════');
    console.log('');
    console.log('Endpoints disponibles:');
    console.log('  GET  /api/game-state');
    console.log('  POST /api/create-preference');
    console.log('  POST /api/confirm-payment');
    console.log('  GET  /api/stats');
    console.log('  POST /api/webhook');
    console.log('');
});
 
module.exports = { app, gameDatabase };