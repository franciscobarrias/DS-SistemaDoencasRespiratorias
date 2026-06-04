function ensureAuthenticated(req: any, res: any, next: any): void {
    try {
        const publicPaths = new Set(['/', '/login.html', '/style.css']);
        if (publicPaths.has(req.path)) {
            return next();
        }

        if (req.session && req.session.authenticated) {
            return next();
        }

        // If request expects JSON (API/XHR), reply 401, otherwise redirect to login page
        const accepts = req.headers && req.headers.accept ? req.headers.accept : '';
        if (req.xhr || accepts.indexOf('application/json') !== -1) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        return res.redirect('/login.html');
    } catch (err) {
        return res.status(500).send('Auth error');
    }
}

function ensureRole(role: string) {
    return (req: any, res: any, next: any) => {
        try {
            if (req.session && req.session.role === role) return next();
            if (req.xhr || (req.headers && req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            return res.status(403).send('Forbidden');
        } catch (err) {
            return res.status(500).send('Role check error');
        }
    };
}

module.exports = { ensureAuthenticated, autenticar: ensureAuthenticated, ensureRole };

export {};
