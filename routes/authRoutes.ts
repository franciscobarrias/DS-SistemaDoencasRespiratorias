const express = require('express');
const router = express.Router();
const path = require('path');

// Same URL strategy:
// - / redirects to the canonical login page
// - /login.html handles the login form
router.get('/', (req: any, res: any) => {
    if (req.session && req.session.authenticated) {
        const userType = req.session.userType || 'medico';
        if (userType === 'paciente') return res.redirect('/paciente.html');
        if (userType === 'admin') return res.redirect('/admin.html');
        return res.redirect('/medico.html');
    }
    return res.redirect('/login.html');
});

// Processa login usando variáveis de ambiente ADMIN_USER / ADMIN_PASS
router.post('/login.html', (req: any, res: any) => {
    const { username, password, userType } = req.body || {};
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || 'admin';

    // Validar tipo de utilizador
    if (!['paciente', 'medico', 'admin'].includes(userType)) {
        return res.status(400).send('Tipo de utilizador inválido. <a href="/login.html">Tentar novamente</a>');
    }

    if (username === adminUser && password === adminPass) {
        // marca sessão como autenticada
        if (req.session) {
            req.session.authenticated = true;
            req.session.userType = userType;
            req.session.username = username;
        }
        
        // Redirecionar para página baseado no tipo
        if (userType === 'paciente') return res.redirect('/paciente.html');
        if (userType === 'admin') return res.redirect('/admin.html');
        return res.redirect('/medico.html');
    }

    return res.status(401).send('Credenciais inválidas. <a href="/login.html">Tentar novamente</a>');
});

router.post('/logout', (req: any, res: any) => {
    if (req.session) {
        req.session.destroy(() => {
            res.redirect('/login.html');
        });
    } else {
        res.redirect('/login.html');
    }
});

module.exports = router;

export {};
