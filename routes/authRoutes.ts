const express = require('express');
const router = express.Router();
const path = require('path');

// Same URL strategy:
// - unauthenticated user at / => login page
// - authenticated user at / => main page
router.get('/', (req: any, res: any) => {
    if (req.session && req.session.authenticated) {
        return res.redirect('/index.html');
    }
    return res.sendFile(path.resolve(__dirname, '..', 'login.html'));
});

// Processa login usando variáveis de ambiente ADMIN_USER / ADMIN_PASS
router.post('/', (req: any, res: any) => {
    const { username, password } = req.body || {};
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || 'admin';

    if (username === adminUser && password === adminPass) {
        // marca sessão como autenticada
        if (req.session) req.session.authenticated = true;
        if (req.session) req.session.role = 'medico';
        return res.redirect('/');
    }

    return res.status(401).send('Credenciais inválidas. <a href="/">Tentar novamente</a>');
});

router.post('/logout', (req: any, res: any) => {
    if (req.session) {
        req.session.destroy(() => {
            res.redirect('/');
        });
    } else {
        res.redirect('/');
    }
});

module.exports = router;

export {};
