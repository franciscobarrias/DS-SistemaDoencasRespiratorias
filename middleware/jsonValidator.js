const Ajv = require('ajv');

// 1. Inicializar o AJV com o modo estrito desativado (strict: false)
// Isto evita que o servidor "crashe" se os teus ficheiros .json tiverem 
// alguma regra de rascunho (draft) mais antiga.
const ajv = new Ajv({ 
    allErrors: true, 
    messages: true, 
    strict: false 
});

// 2. Middleware genérico que aceita um schema como argumento
const validateBody = (schema) => {
    // O AJV compila o contrato aqui (agora sem dar erro de compilação)
    const validate = ajv.compile(schema);
    
    return (req, res, next) => {
        const valid = validate(req.body);
        
        // Se o Frontend enviar dados que não cumprem o contrato:
        if (!valid) {
            return res.status(400).json({
                erro: "Contrato de dados violado (JSON Schema)",
                detalhes: validate.errors.map(err => ({
                    campo: err.instancePath || "Raiz do Objeto",
                    mensagem: err.message
                }))
            });
        }
        
        // Se estiver tudo bem, o pedido segue caminho para o Controller!
        next();
    };
};

module.exports = validateBody;