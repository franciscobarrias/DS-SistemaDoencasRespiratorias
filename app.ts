const API_URL = 'http://localhost:3000';

let graficoSintomasAtivo = null;

let graficoHistoricoAtivo = null;

let utenteFichaAtualId = null; 

declare const Chart: any;

type MaybeInput = HTMLInputElement | null;

const getInputValue = (id: string): string => {
    return (document.getElementById(id) as MaybeInput)?.value ?? '';
};

const setInputValue = (id: string, value: string): void => {
    const input = document.getElementById(id) as MaybeInput;
    if (input) input.value = value;
};


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

                    <strong>Utente: ${escaparHTML(alerta.utente_nome)} (ID: ${alerta.utente_id})</strong>

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

        const res = await fetch(`${API_URL}/utentes?t=${Date.now()}`);

        const dados = await res.json();



        if (kpiUtentes) kpiUtentes.innerText = dados.length;



        lista.innerHTML = '';

        dados.forEach(utente => {

            const item = document.createElement('li');

            item.innerHTML = `

                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">

                    <div>

                        <strong>${escaparHTML(utente.nome)} (ID: ${utente.id})</strong> <br>

                        <span style="color:var(--text-muted); font-size:13px;">📧 ${escaparHTML(utente.email)} | 📞 ${escaparHTML(utente.telefone)}</span>

                    </div>

                    <button class="btn-blue" onclick="abrirFichaClinica(${utente.id}, '${utente.nome.replace(/'/g, "\\'")}', '${escaparHTML(utente.email)}', '${escaparHTML(utente.telefone)}')">👁️ Ver Ficha</button>

                </div>

            `;

            lista.appendChild(item);

        });

    } catch (err) {

        console.error("Erro ao carregar utentes:", err);

    }

}



async function abrirFichaClinica(id, nome, email, telefone) {

    utenteFichaAtualId = id; // Memoriza o utente atual para associar os medicamentos corretos

    document.getElementById('prof-nome').innerText = nome;

    document.getElementById('prof-contactos').innerText = `📧 ${email} | 📞 ${telefone} | Módulo de Análise ID: ${id}`;

   

    const listaSintomas = document.getElementById('prof-lista-sintomas');

    const listaCarat = document.getElementById('prof-lista-carat');

    const listaTerapeutica = document.getElementById('prof-lista-terapeutica'); // Nova lista

   

    listaSintomas.innerHTML = '<li>A carregar sintomas...</li>';

    listaCarat.innerHTML = '<li>A carregar avaliações...</li>';

    listaTerapeutica.innerHTML = '<li>A carregar terapêutica...</li>';

   

    document.getElementById('modal-perfil').style.display = 'flex';



    try {

        // Dispara os três pedidos HTTP em paralelo

        const [resSintomas, resHistorico, resTerap] = await Promise.all([

            fetch(`${API_URL}/sintomas/${id}`),

            fetch(`${API_URL}/utentes/${id}/history`),

            fetch(`${API_URL}/utentes/${id}/terapeutica`)

        ]);



        const sintomas = await resSintomas.json();

        const historico = await resHistorico.json();

        const terapeutica = await resTerap.json();



        // ---- Renderizar Terapêutica ----

        listaTerapeutica.innerHTML = '';

        if (terapeutica.length === 0) {

            listaTerapeutica.innerHTML = '<li style="color:var(--text-muted); font-size:13px; grid-column: span 2;">Nenhuma terapêutica registada.</li>';

        } else {

            terapeutica.forEach(med => {

                listaTerapeutica.innerHTML += `

                    <li style="background: white; border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px; display: flex; flex-direction: column;">

                        <strong style="color: var(--primary); font-size: 14px;">💊 ${escaparHTML(med.medicamento)}</strong>

                        <span style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">🔄 Posologia: ${escaparHTML(med.posologia)}</span>

                    </li>`;

            });

        }



        // ---- Renderizar Sintomas Individuais ----

        listaSintomas.innerHTML = '';

        if (sintomas.length === 0) {

            listaSintomas.innerHTML = '<li style="color:var(--text-muted); font-size:13px;">Nenhum sintoma ativo reportado.</li>';

        } else {

            sintomas.forEach(s => {

                const sevForColor = (s.severidade === 'Moderada') ? 'Normal' : s.severidade;
                const corBadge = sevForColor === 'Grave' ? '#ef4444' : (sevForColor === 'Normal' ? '#f59e0b' : '#10b981');

                listaSintomas.innerHTML += `

                    <li style="padding: 8px 0; border-bottom: 1px dashed #e5e7eb; font-size: 13px;">

                        <span style="background:${corBadge}; color:white; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold; margin-right:5px;">${s.severidade}</span>

                        "${escaparHTML(s.descricao)}"

                    </li>`;

            });

        }



        // ---- Renderizar Histórico e Preparar o Gráfico de Linhas ----

        listaCarat.innerHTML = '';

        const labelsDatas = [];

        const dadosScores = [];



        if (historico.length === 0) {

            listaCarat.innerHTML = '<li style="color:var(--text-muted); font-size:13px;">Nenhum teste CARAT realizado.</li>';

            gerarGraficoEvolucao([], []);

        } else {

            historico.forEach(h => {

                const dataFormatada = new Date(h.data).toLocaleDateString('pt-PT');

                labelsDatas.push(dataFormatada);

                dadosScores.push(h.score_total);



                const corScore = h.score_total < 24 ? 'color:#ef4444' : 'color:#10b981';

                listaCarat.innerHTML += `

                    <li style="padding: 6px 0; border-bottom: 1px dashed #e5e7eb; font-size: 13px; display:flex; justify-content:space-between;">

                        <span>📅 ${dataFormatada}</span>

                        <strong style="${corScore}">Score: ${h.score_total}/30</strong>

                    </li>`;

            });

           

            gerarGraficoEvolucao(labelsDatas, dadosScores);

        }



    } catch (err) {

        console.error("Erro ao carregar Ficha Clínica:", err);

        listaSintomas.innerHTML = '<li>Erro ao ligar ao servidor.</li>';

        listaCarat.innerHTML = '<li>Erro ao ligar ao servidor.</li>';

        listaTerapeutica.innerHTML = '<li>Erro ao ligar ao servidor.</li>';

    }

}



function fecharFichaClinica() {

    document.getElementById('modal-perfil').style.display = 'none';

}



function gerarGraficoEvolucao(labels, dados) {

    const ctx = document.getElementById('graficoHistoricoUtente');

    if (!ctx) return;



    if (graficoHistoricoAtivo) graficoHistoricoAtivo.destroy();



    graficoHistoricoAtivo = new Chart(ctx, {

        type: 'line',

        data: {

            labels: labels,

            datasets: [{

                label: 'Score CARAT',

                data: dados,

                borderColor: '#3b82f6',

                backgroundColor: 'rgba(59, 130, 246, 0.1)',

                borderWidth: 3,

                tension: 0.2,

                fill: true,

                pointBackgroundColor: '#1e3a8a',

                pointRadius: 5

            }]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            scales: {

                y: {

                    min: 0,

                    max: 30,

                    grid: { color: '#e5e7eb' },

                    ticks: { stepSize: 5 }

                },

                x: { grid: { display: false } }

            },

            plugins: {

                legend: { display: false }

            }

        }

    });

}



// 🛡️ Lógica para gravar o novo medicamento

async function gravarMedicamento() {

    if (!utenteFichaAtualId) return;



    const medicamento = getInputValue('input-med-nome');

    const posologia = getInputValue('input-med-pos');



    if (!medicamento) {

        alert("O nome do medicamento é obrigatório.");

        return;

    }



    try {

        const res = await fetch(`${API_URL}/utentes/${utenteFichaAtualId}/terapeutica`, {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({ medicamento, posologia })

        });



        if (res.ok) {

            setInputValue('input-med-nome', '');

            setInputValue('input-med-pos', '');

           

            // Força a recarregar a ficha para mostrar o novo medicamento instantaneamente

            abrirFichaClinica(utenteFichaAtualId, document.getElementById('prof-nome').innerText, '', '');

        } else {

            alert("Erro ao gravar medicamento no servidor.");

        }

    } catch (err) {

        console.error("Erro:", err);

        alert("Erro de comunicação.");

    }

}

// ==========================================



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



async function carregarSintomas() {

    const lista = document.getElementById('lista-sintomas');

    if (!lista) return;



    try {

        const urlRequest = `${API_URL}/sintomas?t=${Date.now()}`;

        const res = await fetch(urlRequest, { cache: 'no-store' });

       

        const sintomas = await res.json();



        lista.innerHTML = '';

        let contagem = { Leve: 0, Normal: 0, Grave: 0 };



        if (sintomas.length === 0) {

            lista.innerHTML = '<li class="empty-state">Sem sintomas registados.</li>';

            atualizarGrafico(0, 0, 0);

            return;

        }



        sintomas.forEach(s => {

            let severidade = s.severidade || 'Leve';
            // Normalizar valores: backend may use 'Normal' while older entries or UI labels use 'Moderada'
            if (severidade === 'Moderada') severidade = 'Normal';

            const descricao = s.descricao || 'Sem descrição';



            if(contagem[severidade] !== undefined) {

                contagem[severidade]++;

            }



            const item = document.createElement('li');

            const badgeClass = severidade.toLowerCase();



            item.innerHTML = `

                <div style="display:flex; justify-content: space-between; align-items: center;">

                    <div>

                        <strong>Sintoma (Utente ID: ${s.utente_id})</strong>

                        <span class="badge ${badgeClass}">${escaparHTML(severidade)}</span>

                    </div>

                    <button onclick="eliminarSintoma(${s.id})" style="background: transparent; border: none; font-size: 18px; cursor: pointer; color: #ef4444;" title="Eliminar Sintoma">🗑️</button>

                </div>

                <div style="margin: 8px 0;">"${escaparHTML(descricao)}"</div>

            `;

            lista.appendChild(item);

        });



        atualizarGrafico(contagem.Leve, contagem.Normal, contagem.Grave);

    } catch (err) {

        console.error("Erro ao carregar sintomas:", err);

        lista.innerHTML = '<li class="empty-state">Erro ao processar sintomas.</li>';

    }

}



async function eliminarSintoma(id) {

    if (!confirm('Tens a certeza que queres eliminar este sintoma?')) return;



    try {

        const res = await fetch(`${API_URL}/sintomas/${id}`, {

            method: 'DELETE'

        });



        if (res.ok) {

            await carregarSintomas();

        } else {

            alert("Erro ao eliminar o sintoma.");

        }

    } catch (err) {

        console.error("Erro ao eliminar sintoma:", err);

        alert("Erro de comunicação com a API.");

    }

}



function toggleFormUtente() {

    const form = document.getElementById('form-novo-utente');

    if (form) {

        form.style.display = form.style.display === 'none' ? 'block' : 'none';

    }

}



async function gravarNovoUtente() {

    const nome = getInputValue('input-utente-nome');

    const email = getInputValue('input-utente-email');

    const telefone = getInputValue('input-utente-tel');



    if (!nome) {

        alert("O Nome do utente é obrigatório.");

        return;

    }



    try {

        const res = await fetch(`${API_URL}/utentes`, {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({ nome, email, telefone })

        });



        if (res.ok) {

            setInputValue('input-utente-nome', '');

            setInputValue('input-utente-email', '');

            setInputValue('input-utente-tel', '');

           

            toggleFormUtente();

            await carregarUtentes();

           

            setTimeout(() => alert("Utente registado com sucesso!"), 10);

        } else {

            const erroDoServidor = await res.text();

            alert(`Erro ao registar utente: ${erroDoServidor}`);

        }

    } catch (err) {

        console.error("Erro no fetch:", err);

        alert("Erro de comunicação com a API.");

    }

}



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

    const utenteId = getInputValue('input-sintoma-utente');

    const descricao = getInputValue('input-sintoma-desc');

    const severidade = getInputValue('input-sintoma-sev');



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

            setInputValue('input-sintoma-desc', '');

           

            await carregarSintomas();

           

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



function configurarPesquisa() {

    const inputPesquisa = document.querySelector('input[placeholder*="Pesquisar"]') as HTMLInputElement | null;

    if (!inputPesquisa) return;



    inputPesquisa.addEventListener('input', (evento) => {

        const termoPesquisa = (evento.target as HTMLInputElement).value.toLowerCase();

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



function atualizarGrafico(leve, normal, grave) {

    const ctx = document.getElementById('graficoSintomas');

    if (!ctx) return;



    if (graficoSintomasAtivo) graficoSintomasAtivo.destroy();



    graficoSintomasAtivo = new Chart(ctx, {

        type: 'doughnut',

        data: {

            labels: ['Leve', 'Moderada', 'Grave'],

            datasets: [{

                data: [leve, normal, grave],

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