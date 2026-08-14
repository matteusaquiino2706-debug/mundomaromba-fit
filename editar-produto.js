// ============================================================
// EDITAR PRODUTO (por LOTE) - VERSÃO CORRIGIDA
// ============================================================

const urlParams = new URLSearchParams(window.location.search);
const loteId = urlParams.get('id');
let loteAtual = null;
let currentUser = null;

function converterNumero(valor) {
    if (typeof valor === 'number') {
        return Number.isFinite(valor) ? valor : 0;
    }

    if (typeof valor !== 'string') return 0;

    const limpo = valor.replace(/[^\d,.-]/g, '').trim();
    if (!limpo) return 0;

    const normalizado = limpo.includes(',')
        ? limpo.replace(/\./g, '').replace(',', '.')
        : limpo;
    const numero = parseFloat(normalizado);
    return Number.isFinite(numero) ? numero : 0;
}

function calcularSaldoLote(lote) {
    const quantidade = converterNumero(lote?.quantidade);
    const vendido = converterNumero(lote?.vendido);
    return Math.max(0, quantidade - vendido);
}

document.addEventListener('DOMContentLoaded', async function() {
    if (!loteId) {
        document.getElementById('message').innerHTML = '❌ Lote não identificado.';
        document.getElementById('message').className = 'message erro';
        return;
    }
    
    window.onAuthStateChanged(window.auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        currentUser = user;
        window.currentUser = user;
        configurarEventos();
        await carregarLote();
    });
});

function configurarEventos() {
    if (window.eventosEditarProdutoConfigurados) return;
    window.eventosEditarProdutoConfigurados = true;
    
    document.getElementById('editarForm').addEventListener('submit', salvarAlteracoes);
    document.getElementById('voltarBtn').addEventListener('click', () => {
        window.location.href = 'dashboard.html?v=20260813-3';
    });
    document.getElementById('cancelarCompraBtn').addEventListener('click', cancelarLote);
    document.getElementById('excluirProdutoBtn').addEventListener('click', excluirLote);
    
    document.getElementById('imagemProduto').addEventListener('input', function() {
        previewImagem(this.value);
    });
    
    document.getElementById('valorUnitario').addEventListener('input', function() {
        const custo = converterNumero(this.value);
        document.getElementById('simulacao40').value = (custo * 1.4).toFixed(2);
    });
}

function previewImagem(url) {
    const container = document.getElementById('previewContainer');
    if (url && url.trim() !== '') {
        container.innerHTML = `<img src="${url}" alt="Pré-visualização" onerror="this.style.display='none'; this.parentElement.innerHTML='<span class=\\'sem-imagem\\'><i class=\\'fas fa-exclamation-triangle\\'></i> Erro ao carregar imagem. Verifique a URL.</span>'">`;
    } else {
        container.innerHTML = '<span class="sem-imagem"><i class="fas fa-image"></i> Nenhuma imagem carregada</span>';
    }
}

async function carregarLote() {
    try {
        const docRef = window.doc(window.db, 'lotes', loteId);
        const docSnap = await window.getDoc(docRef);
        
        if (!docSnap.exists()) {
            document.getElementById('message').innerHTML = '❌ Lote não encontrado!';
            document.getElementById('message').className = 'message erro';
            return;
        }
        
        loteAtual = docSnap.data();
        const saldo = calcularSaldoLote(loteAtual);
        
        document.getElementById('produtoTitulo').innerHTML = `
            <strong>${loteAtual.marca} - ${loteAtual.produto}</strong><br>
            <small><i class="far fa-calendar-alt"></i> Lote: ${loteAtual.dataCompra} | <i class="fas fa-box"></i> Saldo: ${saldo} unidades</small>
        `;
        
        document.getElementById('dataCompra').value = loteAtual.dataCompra || '';
        document.getElementById('nome').value = loteAtual.produto || '';
        document.getElementById('marca').value = loteAtual.marca || '';
        document.getElementById('peso').value = loteAtual.peso || '';
        document.getElementById('sabor').value = loteAtual.sabor || '';
        document.getElementById('familia').value = loteAtual.familia || '';
        document.getElementById('valorUnitario').value = converterNumero(loteAtual.custoUnitario) || 0;
        document.getElementById('valorSugerido').value = converterNumero(loteAtual.valorSugerido) || '';
        document.getElementById('quantidadeEstoque').value = saldo;
        
        const imagemUrl = loteAtual.imagemUrl || '';
        document.getElementById('imagemProduto').value = imagemUrl;
        previewImagem(imagemUrl);
        
        const simulacao = (loteAtual.custoUnitario || 0) * 1.4;
        document.getElementById('simulacao40').value = simulacao.toFixed(2);
        
    } catch (error) {
        console.error('Erro:', error);
        document.getElementById('message').innerHTML = '❌ Erro ao carregar lote: ' + error.message;
        document.getElementById('message').className = 'message erro';
    }
}

async function salvarAlteracoes(event) {
    event.preventDefault();
    
    try {
        const custoUnitario = converterNumero(document.getElementById('valorUnitario').value);
        const valorSugerido = converterNumero(document.getElementById('valorSugerido').value);
        const quantidade = parseInt(document.getElementById('quantidadeEstoque').value);
        const dataCompra = document.getElementById('dataCompra').value;
        const imagemUrl = document.getElementById('imagemProduto').value.trim() || '';

        if (!Number.isFinite(quantidade) || quantidade < 0) {
            throw new Error('Informe um saldo disponível válido.');
        }
        
        const vendido = converterNumero(loteAtual.vendido);
        const novaQuantidadeTotal = quantidade + vendido;
        
        const atualizacao = {
            produto: document.getElementById('nome').value,
            marca: document.getElementById('marca').value,
            peso: document.getElementById('peso').value,
            sabor: document.getElementById('sabor').value || 'Sem sabor',
            familia: document.getElementById('familia').value,
            custoUnitario: custoUnitario,
            simulacao40: custoUnitario * 1.4,
            valorSugerido: valorSugerido > 0 ? valorSugerido : null,
            quantidade: novaQuantidadeTotal,
            dataCompra: dataCompra,
            imagemUrl: imagemUrl,
            ativo: (novaQuantidadeTotal - vendido) > 0
        };
        
        const docRef = window.doc(window.db, 'lotes', loteId);
        await window.updateDoc(docRef, atualizacao);
        
        document.getElementById('message').innerHTML = '✅ Lote atualizado com sucesso!';
        document.getElementById('message').className = 'message sucesso';
        
        setTimeout(() => {
            window.location.href = 'dashboard.html?v=20260813-3';
        }, 1500);
        
    } catch (error) {
        document.getElementById('message').innerHTML = '❌ Erro ao salvar: ' + error.message;
        document.getElementById('message').className = 'message erro';
    }
}

async function cancelarLote() {
    const quantidadeCancelar = parseInt(document.getElementById('quantidadeCancelar').value);
    const motivo = document.getElementById('motivoCancelamento').value;
    const saldo = calcularSaldoLote(loteAtual);
    
    if (!quantidadeCancelar || quantidadeCancelar <= 0) {
        document.getElementById('message').innerHTML = 'Digite uma quantidade válida.';
        document.getElementById('message').className = 'message erro';
        return;
    }
    
    if (quantidadeCancelar > saldo) {
        document.getElementById('message').innerHTML = `❌ Saldo insuficiente! Disponível: ${saldo} unidades.`;
        document.getElementById('message').className = 'message erro';
        return;
    }
    
    const confirmar = confirm(`⚠️ Confirmar cancelamento de ${quantidadeCancelar} unidade(s) do lote de ${loteAtual.dataCompra}?\nMotivo: ${motivo}`);
    if (!confirmar) return;
    
    try {
        const docRef = window.doc(window.db, 'lotes', loteId);
        await window.runTransaction(window.db, async (transaction) => {
            const docSnap = await transaction.get(docRef);
            if (!docSnap.exists()) {
                throw new Error('Lote não encontrado.');
            }

            const lote = docSnap.data();
            const saldoAtual = calcularSaldoLote(lote);
            if (quantidadeCancelar > saldoAtual) {
                throw new Error(`Saldo insuficiente! Disponível agora: ${saldoAtual} unidades.`);
            }

            const novoSaldo = saldoAtual - quantidadeCancelar;
            const novaQuantidadeTotal = converterNumero(lote.quantidade) - quantidadeCancelar;
            const custoUnitario = converterNumero(lote.custoUnitario);

            transaction.update(docRef, {
                quantidade: novaQuantidadeTotal,
                ativo: novoSaldo > 0
            });

            const cancelamentoRef = window.doc(window.collection(window.db, 'cancelamentos'));
            transaction.set(cancelamentoRef, {
                loteId: loteId,
                produto: lote.produto,
                marca: lote.marca,
                sabor: lote.sabor || '',
                peso: lote.peso || '',
                quantidade: quantidadeCancelar,
                valorUnitario: custoUnitario,
                valorTotal: custoUnitario * quantidadeCancelar,
                motivo: motivo,
                data: new Date().toISOString(),
                tipo: 'cancelamento_lote',
                registradoPor: currentUser?.email || 'desconhecido'
            });
        });
        
        document.getElementById('message').innerHTML = `✅ Cancelamento registrado! ${quantidadeCancelar} unidade(s) removidas.`;
        document.getElementById('message').className = 'message sucesso';
        
        setTimeout(() => {
            window.location.href = 'dashboard.html?v=20260813-3';
        }, 1500);
        
    } catch (error) {
        document.getElementById('message').innerHTML = '❌ Erro ao cancelar: ' + error.message;
        document.getElementById('message').className = 'message erro';
    }
}

async function excluirLote() {
    const saldo = calcularSaldoLote(loteAtual);

    if (converterNumero(loteAtual.vendido) > 0) {
        document.getElementById('message').innerHTML = '❌ Este lote já possui vendas registradas. Para manter o histórico correto, cancele apenas o saldo restante em vez de excluir o lote.';
        document.getElementById('message').className = 'message erro';
        return;
    }

    const confirmar = confirm(`🚨 PERIGO! Excluir PERMANENTEMENTE o lote:\n\n${loteAtual.marca} - ${loteAtual.produto}\nData: ${loteAtual.dataCompra}\nSaldo: ${saldo} unidades\n\nDigite "EXCLUIR" para confirmar:`);
    
    if (!confirmar) return;
    
    const texto = prompt('Digite "EXCLUIR" para confirmar:');
    if (texto !== 'EXCLUIR') {
        alert('Exclusão cancelada.');
        return;
    }
    
    try {
        await window.deleteDoc(window.doc(window.db, 'lotes', loteId));
        alert('✅ Lote excluído permanentemente!');
        window.location.href = 'dashboard.html?v=20260813-3';
    } catch (error) {
        document.getElementById('message').innerHTML = '❌ Erro ao excluir: ' + error.message;
        document.getElementById('message').className = 'message erro';
    }
}
