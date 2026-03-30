// Constante base para a API (facilita se mudares de servidor no futuro)
const API_URL = 'http://localhost:3000';

function carregarUtentes() {
    const lista = document.getElementById('lista-utentes');
    lista.innerHTML = '<li style="text-align: center;">A carregar...</li>';
    fetch(`${API_URL}/utentes`)
        .then(resposta => resposta.json())
        .then(dados => {
            lista.innerHTML = ''; 
            dados.utentes.forEach(utente => {
                const item = document.createElement('li');
                item.innerHTML = `<strong>${utente.nome}</strong> <br> 📧 ${utente.email} | 📞 ${utente.telefone}`;
                lista.appendChild(item);
            });
        })
        .catch(erro => { lista.innerHTML = '<li>Erro ao carregar dados.</li>'; });
}

function carregarAvaliacoes() {
    const lista = document.getElementById('lista-avaliacoes');
    lista.innerHTML = '<li style="text-align: center;">A carregar...</li>';
    fetch(`${API_URL}/avaliacoes`)
    .then(resposta => resposta.json())
    .then(dados => {
            lista.innerHTML = ''; 
            dados.avaliacoes.forEach(avaliacao => {
                const item = document.createElement('li');
                const dataFormatada = avaliacao.data_preenchimento 
                    ? new Date(avaliacao.data_preenchimento).toLocaleString('pt-PT') 
                    : 'Data não registada';

                item.innerHTML = `<strong>Utente ID: ${avaliacao.utente_id}</strong> <span style="color: #666; font-size: 0.9em;">(${dataFormatada})</span> <br> 
                                Score: <strong>${avaliacao.score_total}</strong> | Interpretação: ${avaliacao.interpretacao}`;
                lista.appendChild(item);
            });
    })
    .catch(erro => { lista.innerHTML = '<li>Erro ao carregar dados.</li>'; });
}

function carregarMedicos() {
    const lista = document.getElementById('lista-medicos');
    lista.innerHTML = '<li style="text-align: center;">A carregar...</li>';
    fetch(`${API_URL}/medicos`)
        .then(resposta => resposta.json())
        .then(dados => {
            lista.innerHTML = ''; 
            dados.medicos.forEach(medico => {
                const item = document.createElement('li');
                item.innerHTML = `<strong>${medico.nome}</strong> - ${medico.especialidade} <br> 
                                    📧 ${medico.email} | 📞 ${medico.telefone}`;
                lista.appendChild(item);
            });
        })
        .catch(erro => { lista.innerHTML = '<li>Erro ao carregar dados.</li>'; });
}

function carregarSintomas() {
    const lista = document.getElementById('lista-sintomas');
    lista.innerHTML = '<li style="text-align: center;">A carregar...</li>';
    fetch(`${API_URL}/sintomas`)
        .then(resposta => resposta.json())
        .then(dados => {
            lista.innerHTML = ''; 
            dados.sintomas.forEach(sintoma => {
                const item = document.createElement('li');
                item.innerHTML = `<strong>Sintoma:</strong> ${sintoma.descricao} <br> 
                                    <strong>Severidade:</strong> ${sintoma.severidade} | <strong>ID Utente:</strong> ${sintoma.utente_id}
                                    <button onclick="apagarSintoma(${sintoma.id})" style="background-color: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; margin-top: 5px; cursor: pointer; float: right; font-size: 12px;">🗑️ Apagar</button>
                                    <div style="clear: both;"></div>`;
                lista.appendChild(item);
            });
        })
        .catch(erro => { lista.innerHTML = '<li>Erro ao carregar dados.</li>'; });
}

function apagarSintoma(id) {
    if (confirm('Tens a certeza que queres apagar este sintoma da base de dados?')) {
        fetch(`${API_URL}/sintomas/${id}`, {
            method: 'DELETE'
        })
        .then(resposta => resposta.json())
        .then(dados => {
            alert(dados.mensagem);
            carregarSintomas(); 
        })
        .catch(erro => console.error('Erro ao apagar:', erro));
    }
}

function enviarSintoma() {
    const utenteId = document.getElementById('symp-utente-id').value;
    const descricao = document.getElementById('symp-descricao').value;
    const severidade = document.getElementById('symp-severidade').value;

    if (!utenteId || !descricao) {
        alert("⚠️ Por favor, preenche o ID do Utente e a Descrição do sintoma!");
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
        if (!res.ok) {
            throw new Error("O servidor deu erro (Status " + res.status + ")");
        }
        return res.json();
    })
    .then(dadosRecebidos => {
        alert("✅ Sintoma guardado na Base de Dados!");
        document.getElementById('symp-descricao').value = '';
        document.getElementById('symp-utente-id').value = '';
        carregarSintomas(); 
    })
    .catch(err => {
        console.error('❌ Erro detetado:', err);
        alert('Erro ao guardar. Abre a consola (F12) para ver o que falhou!');
    });
}