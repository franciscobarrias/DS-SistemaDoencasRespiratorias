function autenticar(req: any, res: any, next: any): void {
    // Middleware simples de autenticação
    // Por enquanto, apenas passa para o próximo middleware/rota
    // Pode ser expandido com JWT ou outro sistema de autenticação
    next();
}

module.exports = { autenticar };

export {};
