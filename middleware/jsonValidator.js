const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, messages: true });

// Middleware genérico que aceita um schema como argumento
const validateBody = (schema) => {
    const validate = ajv.compile(schema);
    
    return (req, res, next) => {
        const valid = validate(req.body);
        if (!valid) {
            return res.status(400).json({
                erro: "Contrato de dados violado (JSON Schema)",
                detalhes: validate.errors.map(err => ({
                    campo: err.instancePath,
                    mensagem: err.message
                }))
            });
        }
        next();
    };
};

module.exports = validateBody;