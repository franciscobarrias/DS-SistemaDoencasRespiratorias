const API_URL = 'http://localhost:3000';
let graficoSintomasAtivo = null;

// ==========================================
// 🛡️ PREVENÇÃO CONTRA XSS
// ==========================================
function escaparHTML(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

// ==========================================
// 1. CARREGAMENTO DE DADOS (API FETCH)
// ==========================================

async function carregarAlertas() {
    const lista = document.getElementById('lista-alertas');
    const kpiAlertas = document.getElementById('kpi-alertas');
    if (!lista) return;

    lista.innerHTML = '<li class="empty-state">A carregar alertas...</li>';

    try {
        const res = await fetch(`${API_URL}/medico/alertas`);
        const alertas = await res.json();

        if (kpiAlertas) kpiAlertas.innerText = alertas.length;

        lista.innerHTML = '';
        if (alertas.length === 0) {
            lista.innerHTML = '<li class="empty-state">✅ Sem alertas ativos.</li>';
            return;
        }

        alertas.forEach(alerta => {
            const item = document.createElement('li');
            item.innerHTML = `
                <div style="display:flex; justify-content: space-between; align-items: center;">
                    <strong>🚨 Utente: ${escaparHTML(alerta.utente_nome)} (ID: ${alerta.utente_id})</strong>
                    <span class="badge grave">${alerta.prioridade}</span>
                </div>
                <div style="color: var(--text-muted); font-size: 13px; margin-top: 5px; margin-bottom: 12px;">
                    Motivo: <strong>${escaparHTML(alerta.tipo)}</strong> - ${new Date(alerta.data_criacao).toLocaleDateString('pt-PT')}
                </div>
                <button class="btn-green full-width" onclick="resolverAlerta(${alerta.id})">✅ Marcar como Resolvido</button>
            `;
            lista.appendChild(item);
        });
    } catch (err) {
        lista.innerHTML = '<li class="empty-state">Erro de ligação à API.</li>';
    }
}

async function carregarUtentes() {
    const lista = document.getElementById('lista-utentes');
    const kpiUtentes = document.getElementById('kpi-utentes');
    if (!lista) return;

    try {
        const res = await fetch(`${API_URL}/utentes`);
        const dados = await res.json();

        if (kpiUtentes) kpiUtentes.innerText = dados.length;

        lista.innerHTML = '';
        dados.forEach(utente => {
            const item = document.createElement('li');
            item.innerHTML = `
                <strong>👤 ${escaparHTML(utente.nome)}</strong> <br> 
                <span style="color:var(--text-muted); font-size:13px;">📧 ${escaparHTML(utente.email)} | 📞 ${escaparHTML(utente.telefone)}</span>
            `;
            lista.appendChild(item);
        });
    } catch (err) {
        console.error("Erro ao carregar utentes:", err);
    }
}

async function carregarAvaliacoes() {
    const lista = document.getElementById('lista-resultados') || document.getElementById('lista-avaliacoes');
    if (!lista) return;

    try {
        const res = await fetch(`${API_URL}/carat-resultados`);
        const avaliacoes = await res.json();

        lista.innerHTML = '';
        if (avaliacoes.length === 0) {
            lista.innerHTML = '<li class="empty-state">Sem dados carregados.</li>';
            return;
        }

        avaliacoes.forEach(aval => {
            const item = document.createElement('li');
            const dataFormatada = new Date(aval.data).toLocaleDateString('pt-PT');
            const corBadge = aval.score_total < 24 ? '#f59e0b' : '#10b981'; 

            item.innerHTML = `
                <div style="display:flex; justify-content: space-between; align-items: center;">
                    <strong>📋 Utente ID: ${aval.utente_id}</strong>
                    <span class="badge" style="background-color: ${corBadge}; color: white; padding: 4px 8px; border-radius: 12px;">Score: ${aval.score_total}</span>
                </div>
                <div style="color: var(--text-muted); font-size: 13px; margin-top: 5px;">
                    📅 ${dataFormatada} - <em>${escaparHTML(aval.interpretacao)}</em>
                </div>
            `;
            lista.appendChild(item);
        });
    } catch (err) {
        console.error("Erro ao carregar avaliações:", err);
        lista.innerHTML = '<li class="empty-state">Erro ao carregar resultados.</li>';
    }
}

async function carregarSintomas(idDoUtente = 1) {
    if (typeof idDoUtente !== 'number' && typeof idDoUtente !== 'string') {
        idDoUtente = 1;
    }

    const lista = document.getElementById('lista-sintomas');
    if (!lista) return;

    try {
        const urlRequest = `${API_URL}/sintomas/${idDoUtente}?t=${Date.now()}`;
        const res = await fetch(urlRequest, { cache: 'no-store' }); 
        
        const sintomas = await res.json();

        lista.innerHTML = '';
        let contagem = { Leve: 0, Moderada: 0, Grave: 0 };

        if (sintomas.length === 0) {
            lista.innerHTML = '<li class="empty-state">Sem sintomas registados.</li>';
            atualizarGrafico(0, 0, 0); 
            return;
        }

        sintomas.forEach(s => {
            const severidade = s.severidade || 'Leve';
            const descricao = s.descricao || 'Sem descrição';

            if(contagem[severidade] !== undefined) {
                contagem[severidade]++;
            }

            const item = document.createElement('li');
            const badgeClass = severidade.toLowerCase();

            item.innerHTML = `
                <div style="display:flex; justify-content: space-between;">
                    <strong>Sintoma</strong>
                    <span class="badge ${badgeClass}">${escaparHTML(severidade)}</span>
                </div>
                <div style="margin: 8px 0;">"${escaparHTML(descricao)}"</div>
            `;
            lista.appendChild(item);
        });

        atualizarGrafico(contagem.Leve, contagem.Moderada, contagem.Grave);
    } catch (err) {
        console.error("Erro ao carregar sintomas:", err);
        lista.innerHTML = '<li class="empty-state">Erro ao processar sintomas.</li>';
    }
}

// ==========================================
// 2. AÇÕES E RESOLUÇÃO
// ==========================================

// 🛡️ A FUNÇÃO DE EXPORTAÇÃO ESTÁ AQUI
async function exportarDadosCSV() {
    try {
        const res = await fetch(`${API_URL}/carat-resultados`);
        const avaliacoes = await res.json();

        if (avaliacoes.length === 0) {
            alert("Não existem dados para exportar.");
            return;
        }

        let csvContent = "ID Avaliação,ID Utente,Score Total,Interpretação,Data\n";

        avaliacoes.forEach(aval => {
            const dataFormatada = new Date(aval.data).toLocaleDateString('pt-PT');
            const score = aval.score_total;
            const interpretacao = aval.interpretacao || "N/A";
            
            csvContent += `${aval.id},${aval.utente_id},${score},"${interpretacao}",${dataFormatada}\n`;
        });

        // O "\uFEFF" garante que o Excel lê os acentos de português corretamente
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "resultados_carat.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (err) {
        console.error("Erro ao exportar Excel:", err);
        alert("Erro ao tentar gerar o ficheiro.");
    }
}

async function resolverAlerta(alertaId) {
    if (!confirm('Confirmas que a situação foi resolvida?')) return;

    try {
        await fetch(`${API_URL}/medico/alertas/${alertaId}/resolver`, {
            method: 'PUT'
        });
        carregarAlertas();
    } catch (err) {
        alert("Erro ao resolver alerta.");
    }
}

async function gravarNovoSintoma() {
    const utenteId = document.getElementById('input-sintoma-utente').value;
    const descricao = document.getElementById('input-sintoma-desc').value;
    const severidade = document.getElementById('input-sintoma-sev').value;

    if (!utenteId || !descricao) {
        alert("Por favor, preenche o ID do Utente e a Descrição.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/sintomas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                utente_id: parseInt(utenteId),
                descricao: descricao,
                severidade: severidade
            })
        });

        if (res.ok) {
            document.getElementById('input-sintoma-desc').value = '';
            
            await carregarSintomas(utenteId); 
            
            setTimeout(() => {
                alert("Sintoma gravado com sucesso!");
            }, 10);
            
        } else {
            const erroDoServidor = await res.text();
            alert(`O Servidor recusou! (Erro HTTP ${res.status}): \n\nDetalhes:\n${erroDoServidor}`);
        }
    } catch (err) {
        console.error("Erro no fetch:", err);
        alert("Erro de comunicação com a API.");
    }
}

// ==========================================
// 3. PESQUISA EM TEMPO REAL
// ==========================================
function configurarPesquisa() {
    const inputPesquisa = document.querySelector('input[placeholder*="Pesquisar"]');
    if (!inputPesquisa) return; 

    inputPesquisa.addEventListener('input', (evento) => {
        const termoPesquisa = evento.target.value.toLowerCase();
        const listaUtentes = document.getElementById('lista-utentes');
        if (!listaUtentes) return;

        const items = listaUtentes.getElementsByTagName('li');
        
        for (let i = 0; i < items.length; i++) {
            const textoItem = items[i].textContent.toLowerCase();
            
            if (textoItem.includes(termoPesquisa)) {
                items[i].style.display = ''; 
            } else {
                items[i].style.display = 'none';
            }
        }
    });
}

// ==========================================
// 4. GRÁFICOS (CHART.JS) E INTERFACE
// ==========================================

function atualizarGrafico(leve, moderada, grave) {
    const ctx = document.getElementById('graficoSintomas');
    if (!ctx) return;

    if (graficoSintomasAtivo) graficoSintomasAtivo.destroy();

    graficoSintomasAtivo = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Leve', 'Moderada', 'Grave'],
            datasets: [{
                data: [leve, moderada, grave],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#6b7280' } 
                }
            }
        }
    });
}

function toggleTheme() {
    const body = document.documentElement;
    const isDark = body.getAttribute('data-theme') === 'dark';
    body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('btn-theme').innerText = isDark ? '🌙' : '☀️';
    localStorage.setItem('tema', isDark ? 'light' : 'dark');
}

// ==========================================
// 5. INICIALIZAÇÃO
// ==========================================

window.onload = () => {
    if (localStorage.getItem('tema') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('btn-theme').innerText = '☀️';
    }
    
    carregarUtentes();
    carregarAlertas();
    carregarSintomas();
    carregarAvaliacoes(); 
    configurarPesquisa(); 
};