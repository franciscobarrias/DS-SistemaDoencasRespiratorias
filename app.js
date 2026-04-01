// Constante base para a API
const API_URL = 'http://localhost:3000';

// 🛡️ Função de Segurança contra XSS (O nosso Escudo!)
function escaparHTML(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = texto; 
    return div.innerHTML;
}

// --- SECÇÃO: ALERTAS E AVALIAÇÕES ---

function carregarAlertas() {
    const lista = document.getElementById('lista-alertas');
    if (!lista) return; // Prevenção de erro caso o cartão não exista
    lista.innerHTML = '<li class="empty-state">A carregar alertas...</li>';
    
    // Usamos a rota de avaliações para procurar quebras do limiar clínico
    fetch(`${API_URL}/avaliacoes`) 
        .then(res => res.json())
        .then(dados => {
            // Filtra avaliações com score menor que 24 (Limiar de controlo)
            const avaliacoesCriticas = dados.avaliacoes.filter(a => a.score_total < 24);
            
            // Atualiza o KPI no topo da página
            const kpiAlertas = document.getElementById('kpi-alertas');
            if (kpiAlertas) kpiAlertas.innerText = avaliacoesCriticas.length;

            lista.innerHTML = '';
            if (avaliacoesCriticas.length === 0) {
                lista.innerHTML = '<li class="empty-state">✅ Sem alertas ativos. Excelente!</li>';
                return;
            }

            avaliacoesCriticas.forEach(alerta => {
                const item = document.createElement('li');
                item.innerHTML = `
                    <div style="display:flex; justify-content: space-between; align-items: center;">
                        <strong>🚨 Utente ID: ${alerta.utente_id}</strong>
                        <span class="badge grave">Crítico</span>
                    </div>
                    <div style="color: #666; font-size: 13px; margin-top: 5px;">
                        Score CARAT de <strong>${alerta.score_total}</strong> detetado (${new Date(alerta.data).toLocaleDateString('pt-PT')}). Requer revisão médica.
                    </div>
                `;
                lista.appendChild(item);
            });
        })
        .catch(erro => { 
            console.error('Erro ao carregar alertas:', erro);
            lista.innerHTML = '<li class="empty-state">Erro de ligação à API.</li>'; 
        });
}

function carregarAvaliacoes() {
    const lista = document.getElementById('lista-avaliacoes');
    if (!lista) return;
    lista.innerHTML = '<li class="empty-state">A carregar...</li>';

    fetch(`${API_URL}/avaliacoes`)
        .then(res => res.json())
        .then(dados => {
            lista.innerHTML = ''; 
            if (dados.avaliacoes.length === 0) {
                lista.innerHTML = '<li class="empty-state">Nenhuma avaliação registada.</li>';
                return;
            }

            dados.avaliacoes.forEach(avaliacao => {
                const item = document.createElement('li');
                const dataFormatada = avaliacao.data 
                    ? new Date(avaliacao.data).toLocaleDateString('pt-PT') 
                    : 'Data não registada';
                
                // Colorir o score de verde ou vermelho com base no limiar (24)
                const corScore = avaliacao.score_total >= 24 ? 'var(--success)' : 'var(--danger)';

                item.innerHTML = `
                    <div style="display:flex; justify-content: space-between; align-items:center;">
                        <strong>Utente ID: ${avaliacao.utente_id}</strong>
                        <span style="font-size: 12px; color: var(--text-muted);">📅 ${dataFormatada}</span>
                    </div>
                    <div style="margin-top: 8px;">
                        Score: <strong style="color: ${corScore}; font-size: 16px;">${avaliacao.score_total}</strong> 
                        <span style="color: var(--text-muted); font-size: 13px;">- ${escaparHTML(avaliacao.interpretacao)}</span>
                    </div>
                `;
                lista.appendChild(item);
            });
        })
        .catch(erro => { 
            console.error('Erro ao carregar avaliações:', erro);
            lista.innerHTML = '<li class="empty-state">Erro ao carregar dados.</li>'; 
        });
}

// --- SECÇÃO: UTENTES E MÉDICOS ---

function carregarUtentes() {
    const lista = document.getElementById('lista-utentes');
    if (!lista) return;
    lista.innerHTML = '<li class="empty-state">A carregar...</li>';

    fetch(`${API_URL}/utentes`)
        .then(res => res.json())
        .then(dados => {
            // Atualiza o KPI no topo da página
            const kpiUtentes = document.getElementById('kpi-utentes');
            if (kpiUtentes) kpiUtentes.innerText = dados.utentes.length;
            
            lista.innerHTML = ''; 
            if (dados.utentes.length === 0) {
                lista.innerHTML = '<li class="empty-state">Nenhum utente registado.</li>';
                return;
            }

            dados.utentes.forEach(utente => {
                const item = document.createElement('li');
                item.innerHTML = `
                    <strong>👤 ${escaparHTML(utente.nome)}</strong> <br> 
                    <span style="color:var(--text-muted); font-size:13px;">
                        📧 ${escaparHTML(utente.email)} | 📞 ${escaparHTML(utente.telefone)}
                    </span>
                `;
                lista.appendChild(item);
            });
        })
        .catch(erro => { 
            console.error('Erro ao carregar utentes:', erro);
            lista.innerHTML = '<li class="empty-state">Erro ao carregar dados.</li>'; 
        });
}

function carregarMedicos() {
    const lista = document.getElementById('lista-medicos');
    if (!lista) return; // Impede erro se o cartão dos médicos não existir no HTML
    lista.innerHTML = '<li class="empty-state">A carregar...</li>';

    fetch(`${API_URL}/medicos`)
        .then(resposta => resposta.json())
        .then(dados => {
            lista.innerHTML = ''; 
            dados.medicos.forEach(medico => {
                const item = document.createElement('li');
                item.innerHTML = `
                    <strong>🩺 ${escaparHTML(medico.nome)}</strong> - <span class="badge leve">${escaparHTML(medico.especialidade)}</span> <br> 
                    <span style="color:var(--text-muted); font-size:13px;">📧 ${escaparHTML(medico.email)} | 📞 ${escaparHTML(medico.telefone)}</span>
                `;
                lista.appendChild(item);
            });
        })
        .catch(erro => { 
            console.error('Erro ao carregar médicos:', erro);
            lista.innerHTML = '<li class="empty-state">Erro ao carregar dados.</li>'; 
        });
}

// --- SECÇÃO: SINTOMAS (CRUD) ---

function carregarSintomas() {
    const lista = document.getElementById('lista-sintomas');
    if (!lista) return;
    lista.innerHTML = '<li class="empty-state">A carregar...</li>';

    fetch(`${API_URL}/sintomas`)
        .then(res => res.json())
        .then(dados => {
            lista.innerHTML = ''; 
            if (dados.sintomas.length === 0) {
                lista.innerHTML = '<li class="empty-state">Nenhum sintoma reportado.</li>';
                return;
            }

            dados.sintomas.forEach(sintoma => {
                const item = document.createElement('li');
                
                // Aplicar a classe CSS do Badge baseada na severidade
                let badgeClass = 'leve';
                if (sintoma.severidade === 'Moderada') badgeClass = 'moderada';
                if (sintoma.severidade === 'Grave') badgeClass = 'grave';

                item.innerHTML = `
                    <div style="display:flex; justify-content: space-between; align-items:center;">
                        <strong>Sintoma #${sintoma.id}</strong>
                        <span class="badge ${badgeClass}">${escaparHTML(sintoma.severidade)}</span>
                    </div>
                    <div style="margin: 8px 0; color: #444;">"${escaparHTML(sintoma.descricao)}"</div>
                    <div style="display:flex; justify-content: space-between; align-items:center; font-size: 12px; color: var(--text-muted);">
                        <span>👤 ID Utente: ${sintoma.utente_id}</span>
                        <button onclick="apagarSintoma(${sintoma.id})" style="background:transparent; color:var(--danger); padding:0; border:none; text-decoration:underline; font-weight:normal;">🗑️ Apagar</button>
                    </div>
                `;
                lista.appendChild(item);
            });
        })
        .catch(erro => { 
            console.error('Erro ao carregar sintomas:', erro);
            lista.innerHTML = '<li class="empty-state">Erro ao carregar dados.</li>'; 
        });
}

function apagarSintoma(id) {
    if (confirm('Tens a certeza que queres apagar este sintoma do sistema?')) {
        fetch(`${API_URL}/sintomas/${id}`, {
            method: 'DELETE'
        })
        .then(resposta => resposta.json())
        .then(dados => {
            carregarSintomas(); 
        })
        .catch(erro => console.error('Erro ao apagar:', erro));
    }
}

function enviarSintoma() {
    const utenteId = document.getElementById('symp-utente-id').value;
    const descricao = document.getElementById('symp-descricao').value;
    const severidade = document.getElementById('symp-severidade').value;

    if (!utenteId || !descricao || !severidade) {
        alert("⚠️ Por favor, preenche todos os campos (ID, Descrição e Severidade)!");
        return;
    }

    const dados = {
        utente_id: parseInt(utenteId), 
        descricao: descricao,
        severidade: severidade
    };

    fetch(`${API_URL}/sintomas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    })
    .then(res => {
        if (!res.ok) throw new Error("O servidor deu erro (Status " + res.status + ")");
        return res.json();
    })
    .then(dadosRecebidos => {
        // Limpar o formulário após gravação de sucesso
        document.getElementById('symp-descricao').value = '';
        document.getElementById('symp-severidade').value = '';
        carregarSintomas(); 
    })
    .catch(err => {
        console.error('❌ Erro detetado:', err);
        alert('Erro ao guardar sintoma. Verifica a ligação à base de dados!');
    });
}