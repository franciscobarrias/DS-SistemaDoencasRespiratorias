-- Limpeza inicial de segurança
DELETE FROM sintomas;
DELETE FROM avaliacoes;
DELETE FROM utentes;

-- 1. Inserir Utentes de Teste
INSERT INTO utentes (id, nome, email, telefone) VALUES 
(1, 'João Silva', 'joao.silva@email.com', '912345678'),
(2, 'Maria Santos', 'maria.santos@email.com', '987654321'),
(3, 'Carlos Costa', 'carlos.costa@email.com', '965412387');

-- 2. Inserir Avaliações Iniciais (Uma Crítica para o alerta, outra Boa)
INSERT INTO avaliacoes (utente_id, score_total, interpretacao, data, estado) VALUES 
(1, 15, 'Asma/Rinite não controlada', '2026-04-01', 'NOVO'),
(2, 28, 'Asma/Rinite controlada', '2026-04-01', 'RESOLVIDO');

-- 3. Inserir Sintomas Iniciais (Para o Gráfico funcionar logo)
INSERT INTO sintomas (utente_id, descricao, severidade) VALUES 
(1, 'Acordou com falta de ar durante a noite', 'Grave'),
(2, 'Espirros matinais ligeiros', 'Leve');