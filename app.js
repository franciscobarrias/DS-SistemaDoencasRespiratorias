const API_URL = 'http://localhost:3000';
let graficoSintomasAtivo = null;

// 🛡️ Prevenção contra XSS
function escaparHTML(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

async function carregarAlertas() {
    const lista = document.getElementById('lista-alertas');
    const kpiAlertas = document.getElementById('kpi-alertas');
    if (!lista) return;

    lista.innerHTML = '<li class="empty-state">A carregar alertas...</li>';

    try {
        // Rota atualizada conforme o clinicaRoutes.js
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
        // Nota: Garante que criaste esta rota GET /utentes no teu backend!
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

async function carregarSintomas() {
    const lista = document.getElementById('lista-sintomas');
    if (!lista) return;

    try {
        // Rota baseada no utente_id (exemplo usando ID 1 para o dashboard geral)
        const res = await fetch(`${API_URL}/sintomas/1`); 
        const sintomas = await res.json();

        lista.innerHTML = '';
        let contagem = { Leve: 0, Moderada: 0, Grave: 0 };

        sintomas.forEach(s => {
            contagem[s.severidade]++;
            const item = document.createElement('li');
            let badgeClass = s.severidade.toLowerCase();

            item.innerHTML = `
                <div style="display:flex; justify-content: space-between;">
                    <strong>Sintoma</strong>
                    <span class="badge ${badgeClass}">${s.severidade}</span>
                </div>
                <div style="margin: 8px 0;">"${escaparHTML(s.descricao)}"</div>
            `;
            lista.appendChild(item);
        });

        atualizarGrafico(contagem.Leve, contagem.Moderada, contagem.Grave);
    } catch (err) {
        console.error("Erro ao carregar sintomas:", err);
    }
}

// ==========================================
// 2. AÇÕES E RESOLUÇÃO
// ==========================================

async function resolverAlerta(alertaId) {
    if (!confirm('Confirmas que a situação foi resolvida?')) return;

    try {
        // Rota atualizada conforme clinicaRoutes.js (PUT /medico/alertas/:id/resolver)
        await fetch(`${API_URL}/medico/alertas/${alertaId}/resolver`, {
            method: 'PUT'
        });
        carregarAlertas();
    } catch (err) {
        alert("Erro ao resolver alerta.");
    }
}

// ==========================================
// 3. GRÁFICOS (CHART.JS) E INTERFACE
// ==========================================

function atualizarGrafico(leve, moderada, grave) {
    const ctx = document.getElementById('graficoSintomas');
    if (!ctx) return;
    const corLegenda = corTema('--text-muted') || '#6b7280';

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
        options: { responsive: true, maintainAspectRatio: false }
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
// 4. INICIALIZAÇÃO
// ==========================================

window.onload = () => {
    if (localStorage.getItem('tema') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('btn-theme').innerText = '☀️';
    }
    
    carregarUtentes();
    carregarAlertas();
    carregarSintomas();
};