const API_URL = 'http://localhost:3000';
let graficoSintomasAtivo = null; 

function corTema(variavel) {
    return getComputedStyle(document.documentElement).getPropertyValue(variavel).trim();
}

// 🛡️ Prevenção contra XSS
function escaparHTML(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = texto; 
    return div.innerHTML;
}

function carregarAlertas() {
    const lista = document.getElementById('lista-alertas');
    if (!lista) return;
    lista.innerHTML = '<li class="empty-state">A carregar alertas...</li>';
    
    fetch(`${API_URL}/avaliacoes`) 
        .then(res => res.json())
        .then(dados => {
            // Filtra scores < 24 e ignora os que já marcaste como resolvidos
            const avaliacoesCriticas = dados.avaliacoes.filter(a => a.score_total < 24 && a.estado !== 'RESOLVIDO');
            
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
                    <div style="color: var(--text-muted); font-size: 13px; margin-top: 5px; margin-bottom: 12px;">
                        Score CARAT de <strong>${alerta.score_total}</strong> detetado (${new Date(alerta.data).toLocaleDateString('pt-PT')}).
                    </div>
                    <button class="btn-green full-width" onclick="resolverAlerta(${alerta.id})">✅ Marcar como Resolvido</button>
                `;
                lista.appendChild(item);
            });
        }).catch(() => lista.innerHTML = '<li class="empty-state">Erro de ligação à API.</li>');
}

function carregarAvaliacoes() {
    const lista = document.getElementById('lista-avaliacoes');
    if (!lista) return;
    fetch(`${API_URL}/avaliacoes`)
        .then(res => res.json())
        .then(dados => {
            lista.innerHTML = ''; 
            if (dados.avaliacoes.length === 0) return lista.innerHTML = '<li class="empty-state">Sem dados.</li>';

            dados.avaliacoes.forEach(avaliacao => {
                const item = document.createElement('li');
                const corScore = avaliacao.score_total >= 24 ? 'var(--success)' : 'var(--danger)';
                item.innerHTML = `
                    <div style="display:flex; justify-content: space-between;">
                        <strong>Utente ID: ${avaliacao.utente_id}</strong>
                        <span style="font-size: 12px; color: var(--text-muted);">📅 ${new Date(avaliacao.data).toLocaleDateString('pt-PT')}</span>
                    </div>
                    <div style="margin-top: 8px;">
                        Score: <strong style="color: ${corScore}; font-size: 16px;">${avaliacao.score_total}</strong> 
                        <span style="color: var(--text-muted); font-size: 13px;">- ${escaparHTML(avaliacao.interpretacao)}</span>
                    </div>
                `;
                lista.appendChild(item);
            });
        });
}

function carregarUtentes() {
    const lista = document.getElementById('lista-utentes');
    if (!lista) return;
    fetch(`${API_URL}/utentes`)
        .then(res => res.json())
        .then(dados => {
            const kpiUtentes = document.getElementById('kpi-utentes');
            if (kpiUtentes) kpiUtentes.innerText = dados.utentes.length;
            
            lista.innerHTML = ''; 
            dados.utentes.forEach(utente => {
                const item = document.createElement('li');
                item.innerHTML = `
                    <strong>👤 ${escaparHTML(utente.nome)}</strong> <br> 
                    <span style="color:var(--text-muted); font-size:13px;">📧 ${escaparHTML(utente.email)} | 📞 ${escaparHTML(utente.telefone)}</span>
                `;
                lista.appendChild(item);
            });
        });
}

function carregarSintomas() {
    const lista = document.getElementById('lista-sintomas');
    if (!lista) return;
    fetch(`${API_URL}/sintomas`)
        .then(res => res.json())
        .then(dados => {
            lista.innerHTML = ''; 
            let contagem = { leve: 0, moderada: 0, grave: 0 };

            dados.sintomas.forEach(sintoma => {
                // Conta para o gráfico
                if (sintoma.severidade === 'Leve') contagem.leve++;
                if (sintoma.severidade === 'Moderada') contagem.moderada++;
                if (sintoma.severidade === 'Grave') contagem.grave++;

                // Gera a lista
                const item = document.createElement('li');
                let badgeClass = sintoma.severidade === 'Moderada' ? 'moderada' : (sintoma.severidade === 'Grave' ? 'grave' : 'leve');

                item.innerHTML = `
                    <div style="display:flex; justify-content: space-between;">
                        <strong>Sintoma #${sintoma.id}</strong>
                        <span class="badge ${badgeClass}">${escaparHTML(sintoma.severidade)}</span>
                    </div>
                    <div style="margin: 8px 0; color: var(--text-main);">"${escaparHTML(sintoma.descricao)}"</div>
                    <div style="display:flex; justify-content: space-between; font-size: 12px; color: var(--text-muted);">
                        <span>👤 ID Utente: ${sintoma.utente_id}</span>
                        <button onclick="apagarSintoma(${sintoma.id})" style="background:transparent; color:var(--danger); padding:0;">🗑️ Apagar</button>
                    </div>
                `;
                lista.appendChild(item);
            });

            // Atualiza o gráfico com os totais
            atualizarGrafico(contagem.leve, contagem.moderada, contagem.grave);
        });
}

function apagarSintoma(id) {
    if (confirm('Tens a certeza que queres apagar este sintoma?')) {
        fetch(`${API_URL}/sintomas/${id}`, { method: 'DELETE' }).then(() => carregarSintomas());
    }
}

function enviarSintoma() {
    const utente_id = document.getElementById('symp-utente-id').value;
    const descricao = document.getElementById('symp-descricao').value;
    const severidade = document.getElementById('symp-severidade').value;

    if (!utente_id || !descricao || !severidade) return alert("Preencha todos os campos!");

    fetch(`${API_URL}/sintomas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utente_id: parseInt(utente_id), descricao, severidade })
    }).then(() => {
        document.getElementById('symp-descricao').value = '';
        document.getElementById('symp-severidade').value = '';
        carregarSintomas(); 
    });
}

// ==========================================
// 2. EXPORTAÇÃO E RESOLUÇÃO DE ALERTAS
// ==========================================

function exportarParaCSV() {
    fetch(`${API_URL}/avaliacoes`)
        .then(res => res.json())
        .then(dados => {
            if (!dados.avaliacoes || dados.avaliacoes.length === 0) {
                return alert("Não há dados para exportar!");
            }

            let csvContent = "ID Avaliacao,ID Utente,Data,Score Total,Interpretacao\n";
            dados.avaliacoes.forEach(a => {
                const dataFormatada = new Date(a.data).toLocaleDateString('pt-PT');
                csvContent += `${a.id},${a.utente_id},${dataFormatada},${a.score_total},"${a.interpretacao}"\n`;
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", "saudinob_relatorio_carat.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        })
        .catch(() => alert("Erro ao gerar o ficheiro Excel."));
}

function resolverAlerta(avaliacaoId) {
    if (!confirm('Confirmas que a situação clínica deste utente foi resolvida?')) return;

    fetch(`${API_URL}/alertas/${avaliacaoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: "RESOLVIDO" })
    })
    .then(res => {
        // Recarrega os alertas para o resolvido desaparecer do ecrã
        carregarAlertas(); 
    })
    .catch(err => {
        console.error("Erro ao resolver alerta:", err);
        alert("Erro de comunicação com a API.");
    });
}

// ==========================================
// 3. GRÁFICOS (CHART.JS)
// ==========================================

function atualizarGrafico(leve, moderada, grave) {
    const ctx = document.getElementById('graficoSintomas');
    if (!ctx) return;
    const corLegenda = corTema('--text-muted') || '#6b7280';

    if (graficoSintomasAtivo) {
        graficoSintomasAtivo.destroy();
    }

    graficoSintomasAtivo = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Leve', 'Moderada', 'Grave'],
            datasets: [{
                data: [leve, moderada, grave],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: corLegenda } }
            }
        }
    });
}

// ==========================================
// 4. INTERFACE (DARK MODE E PESQUISA)
// ==========================================

function toggleTheme() {
    const body = document.documentElement;
    const btn = document.getElementById('btn-theme');
    
    if (body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        btn.innerText = '🌙';
        localStorage.setItem('tema', 'light');
    } else {
        body.setAttribute('data-theme', 'dark');
        btn.innerText = '☀️';
        localStorage.setItem('tema', 'dark');
    }

    // Recria o gráfico para aplicar a nova cor da legenda no canvas.
    carregarSintomas();
}

function filtrarUtentes() {
    const input = document.getElementById('pesquisa-utente').value.toLowerCase();
    const lista = document.getElementById('lista-utentes');
    const itens = lista.getElementsByTagName('li');

    for (let i = 0; i < itens.length; i++) {
        if (itens[i].classList.contains('empty-state')) continue;
        const texto = itens[i].innerText.toLowerCase();
        itens[i].style.display = texto.includes(input) ? "" : "none";
    }
}

// ==========================================
// 5. INICIALIZAÇÃO (ARRANQUE)
// ==========================================

window.onload = () => {
    // Aplica o tema guardado
    if (localStorage.getItem('tema') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('btn-theme').innerText = '☀️';
    }
    
    // Liga os motores e carrega os dados
    carregarUtentes();
    carregarAlertas();
    carregarAvaliacoes();
    carregarSintomas();
};