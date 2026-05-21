-- 1. Inserir um Médico
INSERT INTO medicos (nome, especialidade, email) 
VALUES ('Dr. Francisco Barrias', 'Pneumologia', 'francisco.med@fmup.pt');

-- 2. Inserir Utentes (Associados ao médico ID 1)
INSERT INTO utentes (nome, email, telefone, medico_id, fhir_id) VALUES 
('João Silva', 'joao.silva@email.com', '912345678', 1, NULL),
('Maria Santos', 'maria.santos@email.com', '987654321', 1, NULL),
('Carlos Costa', 'carlos.costa@email.com', '965412387', 1, NULL);

-- 3. Inserir uma Avaliação com Score Baixo (Para testar o alerta)
INSERT INTO avaliacoes_carat (utente_id, respostas, score_total, interpretacao, conclusao) 
VALUES (1, '[1,1,1,2,1,1,1,2,1,1]', 12, 'Não Controlada', 'Necessita de revisão clínica urgente.');

-- 4. Inserir o Alerta correspondente à avaliação acima
INSERT INTO alertas (utente_id, avaliacao_id, tipo, prioridade, estado) 
VALUES (1, 1, 'Controlo Insuficiente', 'Alta', 'NOVO');

-- 5. Inserir Sintomas para popular o gráfico
INSERT INTO sintomas (utente_id, descricao, severidade) VALUES 
(1, 'Pieira persistente', 'Grave'),
(2, 'Espirros ocasionais', 'Leve'),
(3, 'Tosse moderada ao exercício', 'Moderada');